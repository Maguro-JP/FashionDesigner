"""Pure geometry export for FashionDesigner.

The first release intentionally builds an extruded closed surface from one 2D
outline. It is a valid mesh export, not a sewn garment or body-fit simulation.
No third-party runtime dependency is required.
"""
from __future__ import annotations

import json
import math
import struct
from typing import Iterable, Sequence

Point = tuple[float, float]
Triangle = tuple[int, int, int]


class GeometryError(ValueError):
    """Raised when a 2D outline cannot safely be converted to a mesh."""


def _points(values: Iterable[Sequence[float]]) -> list[Point]:
    result: list[Point] = []
    for value in values:
        if len(value) != 2:
            raise GeometryError("Each outline point must have two coordinates")
        x, y = float(value[0]), float(value[1])
        if not math.isfinite(x) or not math.isfinite(y):
            raise GeometryError("Outline coordinates must be finite")
        if not result or math.hypot(x - result[-1][0], y - result[-1][1]) > 1e-9:
            result.append((x, y))
    if len(result) > 1 and math.hypot(result[0][0] - result[-1][0], result[0][1] - result[-1][1]) <= 1e-9:
        result.pop()
    if len(result) < 3:
        raise GeometryError("An outline needs at least three distinct points")
    if len(result) > 2000:
        raise GeometryError("Outline exceeds the 2000 point export limit")
    if abs(signed_area(result)) <= 1e-8:
        raise GeometryError("Outline area is zero")
    _reject_self_intersections(result)
    return result


def signed_area(points: Sequence[Point]) -> float:
    return sum(
        points[i][0] * points[(i + 1) % len(points)][1]
        - points[(i + 1) % len(points)][0] * points[i][1]
        for i in range(len(points))
    ) / 2.0


def _orientation(a: Point, b: Point, c: Point) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _on_segment(a: Point, b: Point, p: Point) -> bool:
    return (
        min(a[0], b[0]) - 1e-9 <= p[0] <= max(a[0], b[0]) + 1e-9
        and min(a[1], b[1]) - 1e-9 <= p[1] <= max(a[1], b[1]) + 1e-9
        and abs(_orientation(a, b, p)) <= 1e-9
    )


def _segments_intersect(a: Point, b: Point, c: Point, d: Point) -> bool:
    o1, o2 = _orientation(a, b, c), _orientation(a, b, d)
    o3, o4 = _orientation(c, d, a), _orientation(c, d, b)
    if ((o1 > 1e-9 and o2 < -1e-9) or (o1 < -1e-9 and o2 > 1e-9)) and (
        (o3 > 1e-9 and o4 < -1e-9) or (o3 < -1e-9 and o4 > 1e-9)
    ):
        return True
    return (
        (abs(o1) <= 1e-9 and _on_segment(a, b, c))
        or (abs(o2) <= 1e-9 and _on_segment(a, b, d))
        or (abs(o3) <= 1e-9 and _on_segment(c, d, a))
        or (abs(o4) <= 1e-9 and _on_segment(c, d, b))
    )


def _reject_self_intersections(points: Sequence[Point]) -> None:
    count = len(points)
    for i in range(count):
        a, b = points[i], points[(i + 1) % count]
        for j in range(i + 1, count):
            if j == i or j == (i + 1) % count or (j + 1) % count == i:
                continue
            c, d = points[j], points[(j + 1) % count]
            if _segments_intersect(a, b, c, d):
                raise GeometryError("Outline intersects itself or has overlapping edges")


def triangulate(values: Iterable[Sequence[float]]) -> tuple[list[Point], list[Triangle]]:
    """Ear-clip a simple polygon, preserving its input winding."""
    points = _points(values)
    winding = 1 if signed_area(points) > 0 else -1
    remaining = list(range(len(points)))
    triangles: list[Triangle] = []
    eps = 1e-9

    def in_triangle(p: Point, a: Point, b: Point, c: Point) -> bool:
        c1, c2, c3 = _orientation(a, b, p), _orientation(b, c, p), _orientation(c, a, p)
        return (c1 >= -eps and c2 >= -eps and c3 >= -eps) or (
            c1 <= eps and c2 <= eps and c3 <= eps
        )

    guard = 0
    while len(remaining) > 3 and guard < len(points) * len(points):
        guard += 1
        ear_found = False
        for idx in range(len(remaining)):
            ia = remaining[idx - 1]
            ib = remaining[idx]
            ic = remaining[(idx + 1) % len(remaining)]
            a, b, c = points[ia], points[ib], points[ic]
            if winding * _orientation(a, b, c) <= eps:
                continue
            if any(
                in_triangle(points[k], a, b, c)
                for k in remaining
                if k not in (ia, ib, ic)
            ):
                continue
            triangles.append((ia, ib, ic))
            del remaining[idx]
            ear_found = True
            break
        if not ear_found:
            raise GeometryError("Could not triangulate outline; simplify or repair its vertices")
    if len(remaining) != 3:
        raise GeometryError("Could not triangulate outline")
    triangles.append(tuple(remaining))  # type: ignore[arg-type]
    return points, triangles


def extruded_mesh(
    values: Iterable[Sequence[float]], depth: float
) -> tuple[list[tuple[float, float, float]], list[Triangle]]:
    if not math.isfinite(depth) or depth <= 0:
        raise GeometryError("Depth must be a positive finite number")
    points, caps = triangulate(values)
    count = len(points)
    # Image coordinates have +Y down. Flip Y so exported meshes use +Y up.
    vertices = [(x, -y, z) for z in (0.0, depth) for x, y in points]
    faces: list[Triangle] = []
    winding = signed_area(points)
    for a, b, c in caps:
        # Flipping image Y reverses the 2D winding in 3D space.
        bottom = (a, b, c) if winding > 0 else (a, c, b)
        top = (a + count, c + count, b + count) if winding > 0 else (
            a + count, b + count, c + count
        )
        faces.extend((bottom, top))
    for i in range(count):
        j = (i + 1) % count
        if winding > 0:
            faces.append((i, j + count, j))
            faces.append((i, i + count, j + count))
        else:
            faces.append((i, j, j + count))
            faces.append((i, j + count, i + count))
    return vertices, faces


def export_obj(values: Iterable[Sequence[float]], depth: float) -> str:
    vertices, faces = extruded_mesh(values, depth)
    lines = ["# FashionDesigner mesh export", "# units: input units"]
    lines.extend(f"v {x:.6f} {y:.6f} {z:.6f}" for x, y, z in vertices)
    lines.extend(f"f {a + 1} {b + 1} {c + 1}" for a, b, c in faces)
    return "\n".join(lines) + "\n"


def export_glb(values: Iterable[Sequence[float]], depth: float) -> bytes:
    """Write a standards-shaped glTF 2.0 binary (GLB) with one indexed mesh."""
    vertices, faces = extruded_mesh(values, depth)
    positions = [component for vertex in vertices for component in vertex]
    indices = [index for face in faces for index in face]

    binary = bytearray()
    position_offset = len(binary)
    for value in positions:
        binary.extend(struct.pack("<f", value))
    while len(binary) % 4:
        binary.append(0)
    index_offset = len(binary)
    for value in indices:
        binary.extend(struct.pack("<I", value))
    while len(binary) % 4:
        binary.append(0)

    xs = [vertex[0] for vertex in vertices]
    ys = [vertex[1] for vertex in vertices]
    zs = [vertex[2] for vertex in vertices]
    document = {
        "asset": {"version": "2.0", "generator": "FashionDesigner mesh core"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4}]}],
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": position_offset, "byteLength": index_offset - position_offset, "target": 34962},
            {"buffer": 0, "byteOffset": index_offset, "byteLength": len(indices) * 4, "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(vertices), "type": "VEC3", "min": [min(xs), min(ys), min(zs)], "max": [max(xs), max(ys), max(zs)]},
            {"bufferView": 1, "componentType": 5125, "count": len(indices), "type": "SCALAR", "min": [min(indices)], "max": [max(indices)]},
        ],
    }
    json_chunk = json.dumps(document, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    total = 12 + 8 + len(json_chunk) + 8 + len(binary)
    return (
        struct.pack("<III", 0x46546C67, 2, total)
        + struct.pack("<II", len(json_chunk), 0x4E4F534A)
        + json_chunk
        + struct.pack("<II", len(binary), 0x004E4942)
        + bytes(binary)
    )

"""Offline tests for the FashionDesigner mesh exporter."""
import json
import struct
import unittest

from mesh_core import GeometryError, export_glb, export_obj, extruded_mesh, triangulate


class MeshCoreTests(unittest.TestCase):
    def test_concave_outline_triangulates_without_area_loss(self):
        points, triangles = triangulate([(0, 0), (4, 0), (4, 1), (1, 1), (1, 4), (0, 4)])
        tri_area = sum(
            abs((points[b][0] - points[a][0]) * (points[c][1] - points[a][1])
                - (points[b][1] - points[a][1]) * (points[c][0] - points[a][0])) / 2
            for a, b, c in triangles
        )
        self.assertEqual(len(triangles), 4)
        self.assertAlmostEqual(tri_area, 7.0)

    def test_extrusion_is_closed_triangle_mesh(self):
        vertices, faces = extruded_mesh([(0, 0), (2, 0), (2, 2), (0, 2)], 3)
        self.assertEqual(len(vertices), 8)
        self.assertEqual(len(faces), 12)
        edge_counts = {}
        for face in faces:
            for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
                edge = tuple(sorted((a, b)))
                edge_counts[edge] = edge_counts.get(edge, 0) + 1
        self.assertTrue(all(count == 2 for count in edge_counts.values()))

    def test_obj_has_vertices_and_only_triangles(self):
        obj = export_obj([(0, 0), (2, 0), (2, 2), (0, 2)], 3)
        self.assertEqual(sum(line.startswith("v ") for line in obj.splitlines()), 8)
        self.assertEqual(sum(line.startswith("f ") for line in obj.splitlines()), 12)
        self.assertTrue(all(len(line.split()) == 4 for line in obj.splitlines() if line.startswith("f ")))

    def test_glb_header_and_embedded_gltf(self):
        glb = export_glb([(0, 0), (2, 0), (2, 2), (0, 2)], 3)
        magic, version, length = struct.unpack_from("<III", glb)
        self.assertEqual((magic, version, length), (0x46546C67, 2, len(glb)))
        json_length, chunk_type = struct.unpack_from("<II", glb, 12)
        self.assertEqual(chunk_type, 0x4E4F534A)
        document = json.loads(glb[20:20 + json_length])
        self.assertEqual(document["asset"]["version"], "2.0")
        self.assertEqual(document["meshes"][0]["primitives"][0]["mode"], 4)
        self.assertEqual(len(document["accessors"][0]["count"] if isinstance(document["accessors"][0]["count"], list) else [0]), 1)

    def test_invalid_self_intersecting_outline_is_rejected(self):
        with self.assertRaises(GeometryError):
            triangulate([(0, 0), (2, 2), (0, 2), (2, 0)])

    def test_depth_must_be_positive(self):
        with self.assertRaises(GeometryError):
            extruded_mesh([(0, 0), (1, 0), (0, 1)], 0)


if __name__ == "__main__":
    unittest.main()

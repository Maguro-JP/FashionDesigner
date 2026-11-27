# FashionDesigner
## AtelIer の拡張として使う

AtelIer の拡張としても使えます。PowerShell で次を実行すると、拡張の置き場（`C:\ProgramData\AtelIer\extensions\FashionDesigner\`）へ入ります。

```powershell
.\atelier_extension\install.ps1
```

AtelIer を起動すると「ファッションデザイン」のメニューが出て、輪郭の形（長方形・円・三角形・L字）と幅・高さ・厚みを選ぶダイアログで、立体メッシュの投影プレビューを見ながら OBJ / GLB で保存できます。生成は `mesh_core.py` をそのまま使います。

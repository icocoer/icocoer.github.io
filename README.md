# homepage

## 测试中的个人主页

### 脚本

- PowerShell 生成文档导航清单：`pwsh ./views/document/generate-docs-manifest.ps1`
- Shell 生成文档导航清单：`bash ./views/document/generate-docs-manifest.sh`
- PowerShell 生成 sitemap：`pwsh ./generate-sitemap.ps1`
- Shell 生成 sitemap：`bash ./generate-sitemap.sh`

默认会读取根目录的 `CNAME` 作为站点域名，并输出到根目录 `sitemap.xml`。如果没有 `CNAME`，可以在运行 sitemap 脚本时传入站点地址。

### GitHub Actions

- [.github/workflows/generate-site-metadata.yml](.github/workflows/generate-site-metadata.yml) 会在 push 到 `main` 时自动生成 `sitemap.xml` 和 `views/document/docs-manifest.json`
- 如果生成结果有变化，工作流会自动提交回仓库

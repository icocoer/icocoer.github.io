# homepage

## 测试中的个人主页

## PR 提交说明

如果你想帮忙补充内容，请优先通过 PR 提交，不要直接改 `main`。

### 提交文档

- Markdown 文档放在 `views/document/docs/` 下，可以按主题自建子目录
- 文档配图或附件放在 `assets/docs/对应文档路径去掉扩展名/` 下
- 图片尽量压缩后再提交，避免仓库体积增长过快

示例：

- 文档：`views/document/docs/linux/example.md`
- 资源：`assets/docs/linux/example/1.png`

### 提交工具

- 每个工具使用独立目录，放在 `views/tools/工具目录/` 下
- 工具入口默认是 `views/tools/工具目录/index.html`
- 同时记得更新 `views/tools/tools.json`，补上标题、描述、标签和入口地址

### 提交前建议

- 本地确认页面能正常打开，资源路径没有写错
- 如果你新增了文档，不必执行文档清单和 sitemap 脚本，actions 会自动生成
- PR 标题尽量写清楚是“新增文档”、“修正文档”还是“新增工具”

### PR 内容建议

- 简单说明这次新增或修改了什么
- 如果改了页面效果，最好附 1 张截图
- 如果有新增资源文件，说明用途，方便 review

### 脚本

- PowerShell 生成文档导航清单：`pwsh ./views/document/generate-docs-manifest.ps1`
- Shell 生成文档导航清单：`bash ./views/document/generate-docs-manifest.sh`
- PowerShell 生成 sitemap：`pwsh ./generate-sitemap.ps1`
- Shell 生成 sitemap：`bash ./generate-sitemap.sh`

默认会读取根目录的 `CNAME` 作为站点域名，并输出到根目录 `sitemap.xml`。如果没有 `CNAME`，可以在运行 sitemap 脚本时传入站点地址。

### GitHub Actions

- [.github/workflows/generate-site-metadata.yml](.github/workflows/generate-site-metadata.yml) 会在 push 到 `main` 时自动生成 `sitemap.xml` 和 `views/document/docs-manifest.json`
- 如果生成结果有变化，工作流会自动提交回仓库

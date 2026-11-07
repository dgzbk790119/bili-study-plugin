# 让其他用户能安装这个插件

这份文档记录 DeepSeek Harness（dsh）的插件添加规则，以及本仓库为了满足这些规则所做的打包配置。

## 1. DSH 眼里的「插件」是什么

dsh 的一个 profile（`~/.dsh/profiles/<name>/`）由若干**组合包（bundle）**和用户自己的 patch 组成。一个 npm 包要能被「添加插件」安装，至少要是组合包；如果它还有浏览器界面，再声明客户端半边。

| 声明 | 位置 | 作用 |
| --- | --- | --- |
| 组合包 | `package.json` 的 `dsh.bundle.patch` | 指向一个（或一组）YAML patch；安装时把这个包加进 profile 的 `dsh.profile.bundles` |
| Host 插件 | patch 里的 `insert[].name` | 解析到本包的入口，在 Host 进程里运行 |
| 浏览器插件 | `package.json` 的 `dsh.client.platform: "web"` + `exports["./client"]` | 由 `/plugins` 提供已构建的 `client.js`，在页面里注册侧栏/面板 |

本仓库的对应关系：

```yaml
# cordis.patch.yml
- insert:
    - id: bili-study
      name: 'dsh-bili-study'
```

```json
// package.json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },
  "client": { "platform": "web", "inject": [] }
}
```

`name` 必须能被 Node 解析到本包（通常就是包名；包内子插件才写子路径）。`exports["./client"]` 指向的必须是**已经构建好的**浏览器 bundle；本仓库的 `client.js` 是手写的 `window.__ModuleLoader__.load(...)`，因此不需要再跑构建。

## 2. 可安装包的硬性清单

- [x] `name` / `version` / `description`
- [x] 不是 `"private": true`（否则 `npm publish` 直接拒绝）
- [x] `dsh.bundle.patch` 指向存在的 YAML
- [x] 有界面时：`dsh.client.platform: "web"`、`exports["./client"]`、入口文件随包发布
- [x] `exports["./cordis.patch.yml"]`、`exports["./package.json"]`（便于管理器/加载器读取，非严格必需）
- [x] `files` 覆盖所有运行时文件（`lib/`、`web/`、`locale/`、入口、patch、icon、README、LICENSE）
- [x] `engines.dsh` 声明兼容范围
- [x] `license` 与 README（插件详情页默认读 README）
- [ ] 发布到 npm 或 Git 仓库（需要账号/网络）

### 版本兼容

dsh 启动时会拿**唯一**的运行时版本（当前 Desktop 是 `0.2.2-rc.1`）检查每个组合包：

- 声明了 `engines.dsh` 时只由它决定，忽略 `peerDependencies`
- 没有 `engines.dsh` 时，`peerDependencies` 里所有 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 都必须匹配
- 预发布版本参与范围匹配；空范围、非法范围视为不兼容
- 不兼容的包会被跳过，并出现在 `skippedBundles`；插件管理器会报 `incompatible-version`，需要用户显式做版本豁免

本仓库声明：

```json
"engines": { "node": ">=22.19.0", "dsh": ">=0.2.1-rc.5 <0.3.0" }
```

调高下限或放宽上限前，先在实际 DSH 版本上跑一遍面板。

## 3. 用户怎么添加

### 3.1 面板（推荐）

侧栏 **插件** → **添加插件** → 输入包名 / Git 地址 / 压缩包 / 本地绝对路径 → **安装** → **立即启用**。

安装对话框会先让 Host 调 `pluginManager.inspect` 读出 spec 指向什么；不是组合包、找不到、已安装都会在输入框下方直接拒绝。安装成功后默认写进 profile 依赖并启用；也可以先装后启用。

### 3.2 命令行

```sh
dsh plugin --profile <profile> add dsh-bili-study
dsh plugin --profile <profile> add git+https://github.com/ijerrywong/bili-study-plugin.git
dsh plugin --profile <profile> add /absolute/path/to/dsh-bili-study
dsh plugin --profile <profile> add ./dsh-bili-study-1.0.0.tgz
```

`dsh plugin` 把参数原样转给 pnpm；`add` 之后是否自动启用由包是否声明组合包决定。没有 HMR 的 profile 需要重启。

### 3.3 插件索引（实验性「发现」）

dsh 有实验性的自定义插件索引：启用 `@deepseek-ai/dsh-experimental-plugin-market-bundle` 后，插件页出现 **发现** 标签，用户可以添加索引源 URL。目前没有官方索引，所以要让别人「发现」本插件，需要自己托管一份索引 JSON（GitHub Pages 即可），而不是只发布 npm 包。插件索引是可选渠道，不影响上面的直接安装。

## 4. 发布渠道

### npm（最标准）

```sh
npm login
npm publish --access public
```

发布后用户直接输入 `dsh-bili-study` 即可。包名目前未被占用（2026-11 查询），但发布前仍应再确认一次。

### GitHub / Git URL（不需要 npm 账号）

```sh
git remote add origin git@github.com:ijerrywong/bili-study-plugin.git
git push -u origin main
```

用户安装：

```sh
dsh plugin --profile desktop add git+https://github.com/ijerrywong/bili-study-plugin.git
```

dsh 在安装 Git 地址前会做一次 `git ls-remote` 可达性检查；GitHub 不通时会提示改用镜像或换方式。Git 安装不会自动获得 npm 的版本更新提示，升级要卸载重装。

### 压缩包

```sh
npm pack
# 得到 dsh-bili-study-1.0.0.tgz
```

把 tgz 发给用户，或上传到可访问的 HTTPS 地址，用户在「添加插件」里填路径/URL。

## 5. 安全边界

- Host 插件运行在 dsh 进程内，拥有当前用户权限，**不受工作区沙箱限制**；「安装第三方插件」的确认框就是在提示这一点。
- 本包没有 `postinstall` / 构建脚本；`npm pack` 不会执行代码。
- 浏览器半边在面板 iframe 里运行，只通过同源 `postMessage` 与宿主通信。
- 抓取只访问 B 站公开接口，不登录、不保存 Cookie；学习数据只写本机 `$DSH_HOME/bili-study/`。

## 6. 本仓库的发布前检查

```sh
npm pack --dry-run          # 看包内容
npm pack                    # 生成 tgz
# 在隔离 profile 里实测：
DSH_HOME=/tmp/dsh-bili-test dsh plugin --profile test add ./dsh-bili-study-1.0.0.tgz
```

本次已在 `0.2.2-rc.1` 的隔离 profile（`DSH_HOME=/tmp/dsh-bili-home`）里实测：

- `npm pack` 产物 78 个文件，`node_modules/dsh-bili-study` 内容完整
- `dsh plugin --profile test add ./dsh-bili-study-1.0.0.tgz` 安装成功，自动写入 profile 的 `dependencies` 与 `dsh.profile.bundles`
- `dsh --profile test --dump-config` 能组合出 `- id: bili-study` 行，说明 `engines.dsh` 兼容检查通过、`cordis.patch.yml` 被正确加载

# @deepseek-ai/dsh-whale-widget

[English](README.md) | 中文

这是一个可选的、可拖拽的小鲸鱼挂件，显示在 DeepSeek Harness 浏览器界面上。它会显示当前 DeepSeek API 余额，点击余额标签可重新查询。

## 启用

```sh
dsh plugin --profile web add @deepseek-ai/dsh-whale-widget
dsh plugin --profile desktop add @deepseek-ai/dsh-whale-widget
```

该插件不会加入默认 profile。桌面安装包会携带该插件，因此可以直接在 desktop profile 中启用，不需要再下载第二套 runtime。

## 行为

浏览器通过同源路由获取静态挂件脚本和鲸鱼图片，浏览器不会收到 API 凭据。Node 插件通过 `ctx.credentials` 读取 `DEEPSEEK_API_KEY`，请求 `https://api.deepseek.com/user/balance`，只把余额数值和币种返回给浏览器。缺少密钥、上游请求失败或上游返回无效数据时，挂件会显示中文错误信息。

挂件不会保存余额、用量或 API token，位置只在当前页面加载期间有效。

## 署名

随附鲸鱼图片改编自 [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，贡献者声明其采用 MIT 许可。

## 模型体验

### 浏览器覆盖层

#### 模型可见内容

`/dsh-whale/*` 浏览器路由不增加提示词、工具 schema、结果或会话记录。

#### Token 影响

挂件不增加请求 token。

#### KV Cache 影响

挂件不增加可缓存的请求前缀。

## 已知限制与延期工作

- **仅显示余额**：用量和费用估算需要版本化的供应商定价来源及独立验证，因此不在本插件中实现。

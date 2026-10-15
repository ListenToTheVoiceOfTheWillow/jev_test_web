# Jev 判断助手

这是一个本地网页工具：输入一段内容和若干选项，服务端调用 TypeSafe Jev，返回最合适的选项、各选项概率和整体置信度。

也可以输入音频。音频会先交给本机的 faster-whisper 转写，转写文本再发送给 Jev 大模型；原始音频不会上传到 TypeSafe。结果页会显示“音频 → 本机 Whisper 转写 → Jev 大模型判断”的实际链路。默认使用 `E:\secondsoft\myclaudeenv\venv` 中的 Python 和 tiny 模型缓存。

每位同事都可以在自己的电脑上运行，并在本地 `.env` 文件中填写自己的 Jev API key。仓库中的 `.env` 只包含占位值，项目不需要安装 Jev Skill，也不需要执行 `npm install`。

## 一、准备环境

安装 Node.js 18 或更高版本：

<https://nodejs.org/>

安装完成后，可以在 PowerShell 中检查：

```powershell
node --version
```

如果能看到类似 `v18`、`v20` 或更高版本，就可以继续运行。

## 二、配置自己的 Jev key

1. 将整个项目文件夹复制到自己的电脑。
2. 如果项目目录中没有 `.env`，复制 `.env.example` 文件并将副本改名为 `.env`。
3. 用记事本打开 `.env`，填入自己的 key：

   ```env
   TYPESAFE_API_KEY=你的Jev_API_key
   ```

不要把 key 填到网页输入框，也不要把填入真实 key 后的 `.env` 再提交或推送到 GitHub。仓库里的 `.env` 只是为了让首次配置更简单，里面没有可用的真实 key。

## 三、启动程序

双击项目目录里的 `start.cmd`。程序会自动启动本地服务并打开浏览器。

如果浏览器没有自动打开，手动访问：

<http://127.0.0.1:8787/>

网页打开后：

1. 在“要判断的内容”中输入问题或文本。
2. 在“判断选项”中保留、修改或添加选项。
3. 点击“交给 Jev 判断”。
4. 查看最终选择、整体置信度和各选项概率。

如果使用音频，在“或输入音频”中选择文件即可；文字和音频可以同时提供，服务端会把两者合并后判断。

网页默认提供三个示例选项：`直接回答`、`询问用户`、`不上班`。这些选项可以按实际用途修改。

音频配置可以通过环境变量覆盖：`JEV_PYTHON`、`WHISPER_MODEL_SIZE`、`WHISPER_MODEL_CACHE`。

## 四、用命令启动

如果不想双击，也可以在项目目录打开 PowerShell，运行：

```powershell
node server.cjs
```

然后在浏览器打开 <http://127.0.0.1:8787/>。

## 五、停止程序

如果是 PowerShell 启动的，在运行窗口按 `Ctrl+C`。

如果是双击 `start.cmd` 启动的，可以关闭服务器窗口，或在任务管理器中结束对应的 `node.exe` 进程。

## 常见问题

### 页面提示“未找到 TYPESAFE_API_KEY”

确认项目目录中存在名为 `.env` 的文件，并且内容格式正确：

```env
TYPESAFE_API_KEY=你的Jev_API_key
```

注意文件名必须是 `.env`，不能是 `.env.txt`。

### 页面打不开

确认 `start.cmd` 对应的服务器窗口仍在运行，然后手动访问：

<http://127.0.0.1:8787/>

如果端口被占用，可以先关闭其他正在运行的 `node.exe` 进程后再启动。

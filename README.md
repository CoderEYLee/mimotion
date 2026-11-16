# mimotion

![ 刷步数](https://github.com/TonyJiangWJ/mimotion/actions/workflows/run.yml/badge.svg)
[![GitHub forks](https://img.shields.io/github/forks/TonyJiangWJ/mimotion?style=flat-square)](https://github.com/TonyJiangWJ/mimotion/forks)
[![GitHub stars](https://img.shields.io/github/stars/TonyJiangWJ/mimotion?style=flat-square)](https://github.com/TonyJiangWJ/mimotion/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/TonyJiangWJ/mimotion?style=flat-square)](https://github.com/TonyJiangWJ/mimotion/issues)

## 小米运动自动刷步数（支持邮箱登录）

- 小米运动自动刷步数，小米运动APP现已改名 `Zepp Life`，为方便说明，后面还是称其为小米运动。但下载注册时请搜索 `Zepp Life`。
- 注册账号后建议先去以下网站测试自己的账号刷步数是否正常（注意这些网站只是网络上收集的，不保证安全和有效性）：
    - https://steps.hubp.de/ 提示密码错误时可以多试几次 或者切换网络
    - https://bs.yanwan.store/run4/ 验证码001或998
- 如无法刷步数同步到支付宝等，建议重新注册一个新的。

## 新注册账号使用方法

由于新注册账号没有绑定过手环，会导致华米拦截向微信同步步数，此时你需要做的就是绑定一次小米1-7代任意手环即可。如果没有可以参考以下步骤：
- 前往 `https://bs.yanwan.store/run4/` 网站执行一次步数同步
- 该网站会自动为你账号绑定一个虚拟设备（感谢该建站大佬）
- 你可以在你 Zepp Life 中看到这个虚拟的设备
- 然后按照以下步骤进行配置即可成功同步了

### 如果觉得好用，请给一个免费的[star](https://github.com/TonyJiangWJ/mimotion/)吧

## Github Actions 部署指南

### 一、Fork 此仓库，然后创建token

#### 创建小权限的限时token，推荐

- 前往[https://github.com/settings/tokens?type=beta](https://github.com/settings/tokens?type=beta)
  创建个人token，建议使用Fine-grained tokens，避免token泄露导致不必要的麻烦。
- 填写token的名称，用于自己区别干嘛用的。
- 选择token有效期，最大时长为1年。一年后需要重新续期或重建，唯一缺点
- `Repository access` 选择 `Only select repositories` 勾选自己fork后的仓库，下拉可搜索：输入 mimotion 进行检索
- 点击 `Repository permissions` 展开菜单，并勾选以下四个权限即可，其他的可以不勾选
    - `Actions` Access: `Read and write` 用于获取Actions的权限
    - `Contents` Access: `Read and write` 用于更新定时任务和日志文件的权限
    - `Metadata` Access: `Read-only` 这个自带的必选
    - `Workflows` Access: `Read and write` 获取用于更新 `.github/workflow` 下文件的权限

#### 你也可以创建更大权限的不限时token

- 建议使用上面的小权限token，这个token无法指定某一个仓库的权限，也就是token一旦泄露将有可能导致其他人直接自由访问和修改你的所有仓库代码
- 前往[https://github.com/settings/tokens/new](https://github.com/settings/tokens/new)创建
- 填写token名称，选择有效期
- `Select scopes` 勾选 `repo` 和 `workflow` 即可

#### 创建完毕后点击最底下的 `Generate token` 即可生成token，复制token并自己保存一下以备后续使用，关闭当前页面后将无法再看到它。

### 二、设置账号密码

#### 前往仓库设置创建变量

- Settings-->Secrets and variables-->Actions-->New repository secret
-
快捷跳转地址 [https://github.com/${你的github用户名}/mimotion/settings/secrets/actions](../../settings/secrets/actions)
- 点击右侧的 `New repository secret` 即可添加Secret

#### 添加名为 **PAT** 的Secret变量，值为第一步申请的token

- `PAT` 的作用是拿来更新随机执行时间以及加密token数据的，为了保证正常使用，一定要配置正确。

#### 添加名为 **AES_KEY** 的Secret变量，请自行创建一个长度为16个字符的字符串作为密钥

- 注意：密钥不要用中文，长度一定要是16个字符，否则可能出错。
- 如果你有多个账号，或者希望程序自动保存登录信息，就需要设置这个 `AES_KEY`。设置之后，程序会用这个密钥把各个账号的登录token信息加密保存起来。**请一定保管好你的密钥，不要泄露。**
- 同时，请确保你已经正确配置了 PAT 密钥，否则程序无法自动保存和提交信息到仓库。
- 第一次配置 `AES_KEY` 后，运行时可能会看到提示：“密钥不正确或者加密内容损坏 放弃token”，**这是正常现象**。因为原来加密文件用的是我的密钥，和你设置的不同，所以会提示不匹配。你直接忽略它，等程序运行完后，就会用你的新密钥生成一份新的加密文件，下次运行就正常了。
- 配置 `AES_KEY` 后，每个人的仓库里面到会保存一份 `encrypted_tokens.data`。每次更新代码时，这个文件会被覆盖。**为了避免丢失你保存的信息，请在更新代码前备份这个文件**，等代码更新完，再把它放回仓库并提交，最后重新运行workflow。

#### 添加名为 **CONFIG** 的Secret变量

- 需要注意Secret变量是密文，提交后无法查看，只能删除或用新值更新，建议本地保存一下自己的配置数据方便后期修改。或者参考步骤八导出配置数据。
- CONFIG的内容：

  ```json
  {
    "ACCOUNTS": [
      {
        "USER": "abcxxx@xx.com",
        "PWD": "password",
        "MIN_STEP": "18000",
        "MAX_STEP": "25000",
        "EXPIRE_DATE": "2025-12-31"
      }
    ],
    "PUSH_PLUS_TOKEN": "",
    "PUSH_PLUS_HOUR": "",
    "PUSH_PLUS_MAX": "30",
    "PUSH_WECHAT_WEBHOOK_KEY": "",
    "PUSH_FEISHU_WEBHOOK_KEY": "",
    "TELEGRAM_BOT_TOKEN": "",
    "TELEGRAM_CHAT_ID": "",
    "SLEEP_GAP": "5",
    "USE_CONCURRENT": "False",
    "PUSH_USER_FULL_NAME": "False"
  }
  ```

  | 字段名                     | 格式                                                                                                             |
  |-------------------------|----------------------------------------------------------------------------------------------------------------|
  | ACCOUNTS                | 账号数组，每个元素包含一个账号的配置（USER/PWD，可选 MIN_STEP/MAX_STEP/EXPIRE_DATE）                                                  |
  | USER                    | 小米运动登录账号，仅支持小米运动账号对应的手机号或邮箱，不支持小米账号                                                                            |
  | PWD                     | 小米运动登录密码，仅支持小米运动账号对应的密码                                                                                        |
  | MIN_STEP                | 最小步数，配置在账号对象内，未配置时默认 18000                                                                                     |
  | MAX_STEP                | 最大步数，最大步数和最小步数随机范围随着时间线性增加，北京时间16点达到最大值。配置在账号对象内，未配置时默认 25000                                                  |
  | EXPIRE_DATE             | 账号过期日期，格式 `YYYY-MM-DD`（如 `2025-12-31`），按北京时间判断。到了过期当天即跳过该账号，不再刷步数；不配置或格式不合法时不生效。过期账号在推送通知中单独归类为"已过期"            |
  | PUSH_PLUS_TOKEN         | 推送加的个人token,申请地址[pushplus](https://www.pushplus.plus/push1.html)，工作流执行完成后推送每个账号的执行状态信息，如没有则不要填写                |
  | PUSH_PLUS_HOUR          | 限制只在某个整点进行pushplus的推送，值为整数，比如设置21，则只在北京时间21点XX分执行时才进行pushplus的消息推送。如不设置或值非数字则每次执行后都会进行推送                       |
  | PUSH_WECHAT_WEBHOOK_KEY | 企业微信推送通知的key，企业微信webhook机器人推送全地址为：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key={机器人的key}，这里配置{机器人的key} |
  | PUSH_FEISHU_WEBHOOK_KEY | 飞书推送通知的key，飞书webhook机器人推送全地址为：https://open.feishu.cn/open-apis/bot/v2/hook/{机器人的key}，这里配置{机器人的key} |
  | PUSH_PLUS_MAX           | 设置pushplus最大推送账号详情数，默认为30，超过30个账号将只推送概要信息：多少个成功多少个失败。因为数量太多会导致内容过长无法推送。具体最大值请自行调试                              |
  | TELEGRAM_BOT_TOKEN      | 设置telegram机器人的token，同时需要配置TELEGRAM_CHAT_ID，否则不会执行推送                                                            |
  | TELEGRAM_CHAT_ID        | 设置telegram的chatId，需要同时配置TELEGRAM_BOT_TOKEN，否则无法执行推送。关于这两个值如何获取，请前往官网查看。                                        |
  | SLEEP_GAP               | 多账号执行间隔，单位秒，如果账号比较多可以设置的短一点，默认为5秒                                                                              |
  | USE_CONCURRENT          | 是否使用多线程，实验性功能，未测试是否有效。账号多的可以试试，将它设置为True即可，启用后 `SLEEP_GAP` 将不再生效                                               |
  | PUSH_USER_FULL_NAME     | 推送通知中账号是否显示完整明文。默认 `False` 脱敏显示（短账号保留首尾各 1/3，长账号保留前3后4，例如 `138****8000`、`abc****@xx.com`）；设置为 `True` 时显示完整账号                |

### 三、多账户设置(如用不上请忽略)

- 多账户在 `ACCOUNTS` 数组中添加多个账号对象即可，每个账号可以单独配置 `USER`/`PWD`，以及可选的 `MIN_STEP`/`MAX_STEP`/`EXPIRE_DATE`（不配置则使用内置默认 18000/25000，不配置 `EXPIRE_DATE` 则不限制过期）
- 理论上账户数量不受限制，但是实际要看github actions的资源和华米接口是否有限制，pushplus消息内容应该也有最大长度限制，反正具体上限请自行测试

#### 例如

```json
{
  "ACCOUNTS": [
    {
      "USER": "13800138000",
      "PWD": "abc123qwe"
    },
    {
      "USER": "13800138001",
      "PWD": "abcqwe2",
      "MIN_STEP": "15000",
      "MAX_STEP": "20000",
      "EXPIRE_DATE": "2025-12-31"
    }
  ],
  "PUSH_PLUS_TOKEN": "",
  "PUSH_PLUS_HOUR": ""
}
```

#### 注意 ACCOUNTS 数组中每个账号对象必须包含 `USER` 和 `PWD`，否则将跳过执行

### 四、自定义启动时间

#### 两种方式自定义启动时间

##### 1、添加名为 `CRON_HOURS` 的Variables变量 `Settings-->Secrets and variables-->Actions-->New repository variables` 注意不是Secret

-
快捷跳转地址 [https://github.com/${你的github用户名}/mimotion/settings/variables/actions](../../settings/variables/actions)
    - 填写自动执行的时间，单位为小时，此处需要设置UTC时间，例如设置 `0,2,4,6,8,14` 则会在北京时间 `8,10,12,14,16,22` 点触发执行
- 添加完成后可以在Actions中手动触发：`Random Cron` 来触发替换，或者等下一次定时执行时它将会自动替换。

##### 2、编辑 **.github/workflows/run.yml** 中的cron表达式

- cron表达式格式如下: `分 小时 日期 月份 年份`
- github actions中执行时间为UTC时间，即**北京时间-8**，如果需要每天`8，10，12，14，16，22`
  点执行，则设置cron为`0 0,2,4,6,8,14 * * *`

  ```yaml
  on:
    schedule:
      - cron: '0 0,2,4,6,8,14 * * *'
  ```

- **注意** 如果已添加 `CRON_HOURS` 变量，则修改此文件的cron表达式会失效，在下次执行 `Random Cron`
  后表达式中小时的部分会被覆盖为 `CRON_HOURS` 配置的值

- 注意以上两种方式二选一即可，推荐直接使用方式1，变量值填写的是逗号分隔的数字，别乱填别的报错别找我！
- github actions 0点为执行高峰，排队可能会延后一两小时才执行，建议直接从2开始

### 五、手动触发测试工作流

- 前往Actions,左侧选择 `刷步数`
  ，快捷链接：[https://github.com/${你的github用户名}/mimotion/actions/workflows/run.yml](../../actions/workflows/run.yml)
- 新fork的仓库默认未启用工作流，进入Actions后点击 `I understand my workflows, go ahead and enable them`
  启用，然后左侧选择 `刷步数` 之后，再点击 `enable workflow` 启用工作流。请确保开启工作流，否则不会定时执行。
- 点击右侧的`Run workflow`触发执行，触发后刷新即可查看执行记录。验证是否正确配置并执行刷步数。

### 六、感谢列表

本项目基于 `https://github.com/xunichanghuan/mimotion(已被ban)`
和 [https://github.com/huangshihai/mimotion](https://github.com/huangshihai/mimotion) 项目修改，特此感谢

新版本登录需要加密，感谢[https://github.com/hanximeng/Zepp_API/blob/main/index.php](https://github.com/hanximeng/Zepp_API/blob/main/index.php)
里面提供的aes加密密钥。大家可以去给作者点个star

### 七、同步最新代码

- 点击仓库界面上的 `Sync fork`，找不到的话直接Ctrl+F网页查找
- 然后点击 `Update branch` 或者 `Discard xxx commits`等待同步完成即可，如有其他提示请自行按提示操作。请不要提交 **pull request**
- 当配置了 `AES_KEY` 之后，因为每个人的仓库里面到会保存一份 `encrypted_tokens.data`，更新代码会被覆盖。为了避免数据丢失，请提前备份，在更新完成后将它重新提交到仓库中，然后再触发workflow。
- 同步更新后请自己再次仔细阅读README，配置项目修改等请自行对比，更新后因为配置不正确导致无法运行请不要找我

### 八、忘记配置后的处理（提取配置信息）

- 当长时间没有使用或者忘记了配置，可以通过手动触发 `提取配置信息` 工作流，把仓库里的 `CONFIG` / `PAT` / `AES_KEY` 提取出来自查。
- ⚠️ **安全提醒（重要）**：本仓库是**公开仓库**，GitHub Actions 日志**任何人可读**。因此该功能的敏感信息处理方式为：
  - 明文配置（含账号**密码 `PWD`**、`AES_KEY`、`PAT`）**只会推送到你私有的飞书 / 企业微信 / Telegram 会话**，**绝不**打印到公开日志；
  - 控制台（`开始` 步骤日志）只打印**加密后的 base64**（没有密钥无法解密），属于脱敏打印；
  - 请把推送目标配置在**只有你自己可见**的私有会话中，收到后建议删除消息。
  - 与此同时，仓库已对登录/token 打印做了脱敏：账号走脱敏显示、token 只打印长度/状态/时间、推送请求不打印含 token 的 URL 与正文，避免任何明文凭证出现在公开日志。

- 支持以下 4 种回显方式，按需选用其一或组合：

  **1) 飞书（推荐，本 fork 新增）**
  - 若你刷步数已配置 `CONFIG.PUSH_FEISHU_WEBHOOK_KEY`（本仓库默认就是飞书推送），**无需额外配置**：提取工作流会自动复用它，把配置推到你平时收通知的飞书群。
  - 若想推到另一个更私密的飞书机器人，单独配置 Secret：`INSPECT_FEISHU_WEBHOOK_KEY`（值为飞书 webhook 地址 `?key=` 后面那串），会优先于上面的复用。

  **2) 企业微信**
  - 配置 Secret：`INSPECT_WECHAT_HOOK_KEY`（企业微信机器人 key），具体请参考企业微信机器人文档。

  **3) Telegram**
  - 配置 Secrets：`INSPECT_TELEGRAM_BOT_TOKEN` 和 `INSPECT_TELEGRAM_CHAT_ID`（`chat_id` 必须是纯数字，不要填成 `@用户名` 或带空格）。
  - 该渠道填写不正确只会在日志告警、不会让工作流失败。

  **4) 控制台加密打印（最安全，不依赖第三方）**
  - 配置 Secret：`INSPECT_AES_KEY`（**严格 16 位**字符串，请勿使用弱密码）。
  - 运行后，在 `开始` 步骤日志中查看 base64 字符串，使用在线 AES 工具解密（CBC / PKCS7 / 128bit，key 与 iv 均为 INSPECT_AES_KEY）：
    https://www.toolhelper.cn/SymmetricEncryption/AES

- 配置好对应渠道后，点击 Actions → 左侧 `提取配置信息` → `Run workflow` 手动运行即可。

### 九、清理历史 workflow runs

日常自动清理**直接用 GitHub 自带的保留期**（见下文），不需要脚本，也不需要任何定时任务。脚本只用于一次性清掉已有的历史存量。

> 为什么不给脚本配定时任务：脚本若做成一个每天运行的 workflow，它自己每天会产生一条新 run，3 天后又被自己删掉，等于「自己造垃圾自己收」，Actions 页面还会一直留着这个清理任务的几条记录。所以定时清理交给 GitHub 原生能力，脚本只负责清存量。

#### 一、日常自动清理：用 GitHub 自带保留期

从 **2026 年 10 月 1 日** 起，GitHub Actions 的 **workflow run 记录**会跟随仓库的 Actions 保留期设置自动清理（此前 run 记录固定保留 400+ 天，只有日志和产物受保留期约束）。不需要脚本、不需要 PAT、不需要新建 workflow。

设置步骤：

1. 打开仓库 `Settings → Actions → General`。
2. 找到 **Check, workflow run, status, artifact and log retention**，把天数改成 `3`（公开仓库可设 `1`–`90` 天，默认 `90` 天），点 `Save`。
3. 之后 GitHub 会自动删除超过 3 天的 workflow runs，无需人工干预。

注意：

- 该设置**不追溯**：只影响设置之后新产生的 run，已经堆积的历史记录仍需用下面的脚本手动清一次。
- 保留期同时作用于 **artifacts 和日志**，设成 3 天后它们也只保留 3 天；若希望日志留久些，把天数调大即可。
- 天数上限受组织/企业策略约束，公开仓库最多 `90` 天。

#### 二、一次性清理历史存量：用脚本

`scripts/clean_workflow_runs.sh` 通过 GitHub API 批量删除「N 天前」的 runs（默认保留最近 3 天，天数由 `DAYS_AGO` 控制）。

- 使用前需要准备一个 GitHub Personal Access Token（classic 的 `repo` 作用域，或 fine-grained 的 `Actions: Read and write`）。
- 用法（在仓库根目录执行）：
  ```shell
  # 1) 预览将要删除的 run（默认 DRY_RUN=1，不会真正删除，只列出数量；默认保留最近 3 天）
  TOKEN=ghp_xxx bash scripts/clean_workflow_runs.sh

  # 2) 确认数量无误后，真正删除
  TOKEN=ghp_xxx DRY_RUN=0 bash scripts/clean_workflow_runs.sh

  # 3) 自定义保留天数（例如保留最近 30 天，删除 30 天前的历史）
  TOKEN=ghp_xxx DAYS_AGO=30 bash scripts/clean_workflow_runs.sh
  ```
- 注意：删除操作**不可逆**，请务必先用预览模式核对数量；脚本不含任何密钥，可安全提交到公开仓库。可通过环境变量 `REPO` 覆盖默认仓库名（默认 `CoderEYLee/mimotion`），通过 `DAYS_AGO` 覆盖保留天数（默认 `3`，须为非负整数）。
- 脚本同时兼容 Linux（GNU date）与 macOS（BSD date），建议在**本地手动运行**，不要再给它配 Actions 定时任务。

## 注意事项

1. 默认每天运行6+次，由run.yml中的cron控制，分钟为随机值，执行后自动更新分钟值，随机后可能当前整点二次执行，例如：8:
   05分执行后，分钟值随机为50，则会在8:50再次执行。

- 如果配置了 `CRON_HOURS` Variable变量，则脚本将自动判断，例如8:05分执行后，将从小时中剔除8，即8:00-8:59都不会再重复执行，避免随机的步数混乱。

2. 多账户的数量和密码请一定要对上 不然无法使用!!!

3. 启动时间得是UTC时间!

4. 如果支付宝没有更新步数，到小米运动->设置->账号->注销账号->清空数据，然后重新登录，重新绑定第三方。建议去开头提到的网站测试账号是否正常

5. 小米运动不会更新步数，只有关联的会同步！！！！！

6. 请各位在使用时Fork[当前仓库](https://github.com/TonyJiangWJ/mimotion/)，防止出现不必要的bug.

7. 请注意，账号不是 [小米账号]，而是 [小米运动/ZeppLife] 的账号。

8. 最大步数和最小步数随着时间增长，10点执行时范围为10/22 \* 18000 ~ 10/22 \* 25000：8181 ~
   11363，以此类推，在北京时间22点达到最大值，即22点执行时随机步数的范围为18000-25000之间。要修改这个范围可以修改CONFIG中的MIN_STEP和MAX_STEP。

9. cron的执行根据github actions的资源进行排队，并不是百分百按指定的时间进行运行，请知悉。

10. 新版本接口有限制，同ip登录过多账号可能会429，请自行测试。

### 查看执行记录

- 前往 [Actions](../../actions) 可以查看所有工作流的执行历史
    - `刷步数 #41: Scheduled` 代表是定时任务触发，`刷步数 #33: Manually run by xxx` 代表手动触发
- 点击其中一条记录，可以查看执行详情，这里以 `刷步数` 为例：
    - 详情界面 `Jobs` 可以查看到一个 `build` ，点击它查看执行步骤
    - 执行步骤中主要关注 `开始` ，点击 `开始` 展开详情
    - 展开后便可以查看到执行日志，如果执行成功，则会显示每个账号当前随机的步数是多少
    - 如果执行失败，则需要根据实际情况分析具体失败原因
- 对于随机Cron的工作流 `Random Cron`，它会在 `刷步数` 执行成功后触发，执行后会更新cron表达式创建随机的分钟值，然后提交到git仓库。这一步失败的主要原因有：
    - `PAT` Secret变量，也就是个人token设置的不正确
    - `CRON_HOURS` Variable变量设置的不正确，需要逗号分隔的小时字符串例如：`1,3,4,5,6,7` 。不要添加奇奇怪怪的东西
    - 其他请见执行日志
- 随机Cron运行完毕后可以查看 `cron_change_time` 文件的内容，记录了触发方式、当前触发时间、cron表达式信息、下一次定时触发时间等信息，示例如下：
  ```log
  trigger by: workflow_run
  current system time:
  UTC: 23-06-03 12:56:53
  北京时间: 23-06-03 20:56:53
  current cron:
  UTC时间: '48 1,4,7,10,12,14 * * *'
  北京时间: '48 9,12,15,18,20,22 * * *'
  next cron:
  UTC时间: '37 1,4,7,10,12,14 * * *'
  北京时间: '37 9,12,15,18,20,22 * * *'
  next exec time: UTC(14:37) 北京时间(22:37)
  ```

## 本地开发

复制 `.env.example` 文件为 `.env`，并在 `.env` 中填入你的配置信息
```shell
cp .env.example .env
```
**注意**：`.env` 文件已添加到 .gitignore 中，请不要推送到代码仓库中以免造成数据泄露

创建 python 虚拟环境
```shell
python3 -m venv venv
```

激活虚拟环境
```shell
# Windows
./venv/Script/Activate

# Linux
source ./venv/bin/activate
```

安装依赖
```shell
pip install -r requirements.txt
```

执行脚本修改步数
```shell
python3 main.py
```
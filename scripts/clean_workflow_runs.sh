#!/usr/bin/env bash
# 清理 CoderEYLee/mimotion 中「N 天前」的 workflow runs（通过 GitHub API 批量删除）
# 保留最近 N 天，N 由 DAYS_AGO 控制，默认 7。
#
# 用法：
#   预览(7天以前)：    TOKEN=ghp_xxx bash scripts/clean_workflow_runs.sh
#   删除(7天以前)：    TOKEN=ghp_xxx DRY_RUN=0 bash scripts/clean_workflow_runs.sh

#   预览(30天以前)：   TOKEN=ghp_xxx DAYS_AGO=30 bash scripts/clean_workflow_runs.sh
#   删除(30天以前)：   TOKEN=ghp_xxx DAYS_AGO=30 DRY_RUN=0 bash scripts/clean_workflow_runs.sh
#
# TOKEN 需要 GitHub Personal Access Token（classic 的 repo 作用域，或 fine-grained 的 Actions:write）
# 删除操作不可逆，请务必先用默认预览模式核对数量后再执行删除。

set -u

REPO="${REPO:-CoderEYLee/mimotion}"
TOKEN="${TOKEN:?请设置 TOKEN 环境变量，例如 TOKEN=ghp_xxx bash scripts/clean_workflow_runs.sh}"
DRY_RUN="${DRY_RUN:-1}"
DAYS_AGO="${DAYS_AGO:-7}"

# 校验 DAYS_AGO 为非负整数
if ! [[ "$DAYS_AGO" =~ ^[0-9]+$ ]]; then
  echo "错误：DAYS_AGO 必须是非负整数，当前值: $DAYS_AGO"
  exit 1
fi

# N 天前的 UTC 时间点（macOS BSD date 语法）
cutoff=$(date -v-"$DAYS_AGO"d -u +%Y-%m-%dT%H:%M:%SZ)

if [ "$DRY_RUN" = "1" ]; then
  mode="预览(不会删除)"
else
  mode="实际删除"
fi

echo "仓库: $REPO"
echo "保留最近 $DAYS_AGO 天，删除 cutoff 之前(不含)的 runs, cutoff=$cutoff"
echo "模式: $mode"
echo "-------------------------------------------------"

# 阶段一：静态遍历所有页，先完整收集所有待删除的 run id。
# 关键：GitHub 的 runs 列表是动态的，边翻页边删除会导致后面的旧 run 前移、
# 再 page++ 时跳过一批。因此收集阶段绝不删除，分页才是稳定的；
# 等全部 id 收集完，再在阶段二统一删除（此时不再翻页）。
all_ids=""
page=1
total=0

while :; do
  resp=$(curl -s -H "Authorization: token $TOKEN" \
    "https://api.github.com/repos/$REPO/actions/runs?per_page=100&page=$page")

  # 简单的 API 错误检查
  err=$(echo "$resp" | jq -r 'if has("message") then .message else "" end')
  if [ -n "$err" ]; then
    echo "API 返回错误: $err"
    exit 1
  fi

  ids=$(echo "$resp" | jq -r ".workflow_runs[] | select(.created_at < \"$cutoff\") | .id")
  n=$(echo "$resp" | jq '.workflow_runs | length')
  cnt=$(echo "$ids" | grep -c .)

  if [ "$cnt" -gt 0 ]; then
    if [ -n "$all_ids" ]; then
      all_ids="$all_ids"$'\n'"$ids"
    else
      all_ids="$ids"
    fi
  fi
  total=$((total + cnt))

  # GitHub API 按 created_at 降序返回（最新在前），旧 run 在后面的页，
  # 必须翻到最后一页（n < 100）才停，确保收集全部旧 run id。
  [ "$n" -lt 100 ] && break

  page=$((page + 1))
done

# 阶段二：基于已固定的 all_ids 处理（预览或删除），此阶段不再翻页，故不会漏数据。
echo "-------------------------------------------------"
if [ "$DRY_RUN" = "1" ]; then
  echo "$all_ids" | grep . | sed 's/^/  将删除 run id: /'
else
  echo "$all_ids" | grep . | while read -r id; do
    [ -z "$id" ] && continue
    code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
      -H "Authorization: token $TOKEN" \
      "https://api.github.com/repos/$REPO/actions/runs/$id")
    if [ "$code" = "204" ]; then
      echo "  已删除 run id: $id -> HTTP $code"
    else
      echo "  删除 run id: $id 失败 -> HTTP $code（请检查 token 权限或 API 限流）"
    fi
    sleep 0.3
  done
fi

echo "-------------------------------------------------"
echo "本次处理(预览/删除)的 run 总数: $total"

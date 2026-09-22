#!/usr/bin/env bash
# 小程序静态验收:语法 / JSON / 结构 / 引用 / 事件绑定 / 残留符号
# 用法:bash scripts/verify.sh   —— 全绿才可交付
cd "$(dirname "$0")/../app" || exit 1
FAIL=0

echo "== 1. JS 语法(node --check) =="
while IFS= read -r f; do
  OUT=$(node --check "$f" 2>&1) || { echo "❌ $f"; echo "$OUT" | head -3; FAIL=1; }
done < <(find . -name "*.js" -not -path "*/node_modules/*")
echo "  js files checked"

echo "== 2. JSON 合法性 =="
while IFS= read -r f; do
  python3 -c "import json;json.load(open('$f'))" 2>/dev/null || { echo "❌ $f"; FAIL=1; }
done < <(find . -name "*.json")
echo "  json files checked"

echo "== 3. 页面四件套 / tabBar / 图标 =="
python3 - <<'PY'
import json, os, sys
app = json.load(open('app.json'))
fail = 0
for p in app['pages']:
    for ext in ('js', 'wxml', 'json', 'wxss'):
        if not os.path.exists(p + '.' + ext):
            print('❌ 缺少', p + '.' + ext); fail = 1
for t in app.get('tabBar', {}).get('list', []):
    if t['pagePath'] not in app['pages']:
        print('❌ tabBar 页未注册:', t['pagePath']); fail = 1
    for k in ('iconPath', 'selectedIconPath'):
        if k in t and not os.path.exists(t[k]):
            print('❌ 图标缺失:', t[k]); fail = 1
sys.exit(1 if fail else 0)
PY
[ $? -ne 0 ] && FAIL=1

echo "== 4. require 路径存在 =="
while IFS=: read -r f line rest; do
  [ -f "$f" ] || continue
  for path in $(echo "$rest" | grep -oE "require\('[^']+'\)" | sed "s/require('//;s/')//"); do
    dir=$(dirname "$f")
    { [ -f "$dir/$path" ] || [ -f "$dir/$path.js" ]; } || { echo "❌ $f:$line → $path 不存在"; FAIL=1; }
  done
done < <(grep -rn "require(" --include="*.js" . 2>/dev/null)
echo "  requires checked"

echo "== 5. WXML 事件处理函数已定义 =="
python3 - <<'PY'
import re, glob, os, sys
fail = 0
for wxml in glob.glob('pages/**/*.wxml', recursive=True):
    jsf = wxml[:-5] + '.js'
    if not os.path.exists(jsf): continue
    code = open(jsf).read()
    for m in re.finditer(r'(?:bind|catch)[a-z]+="([A-Za-z_]\w*)"', open(wxml).read()):
        fn = m.group(1)
        if not re.search(r'\b' + fn + r'\s*[(:]', code):
            print(f'❌ {wxml}: 处理函数 {fn} 未定义'); fail = 1
sys.exit(1 if fail else 0)
PY
[ $? -ne 0 ] && FAIL=1

echo "== 6. WXML 标签配对 =="
python3 - <<'PY'
import re, glob, sys
fail = 0
for f in glob.glob('pages/**/*.wxml', recursive=True) + glob.glob('*.wxml'):
    src = re.sub(r'\{\{[^}]*\}\}', '', open(f).read())  # 去掉插值防干扰
    stack = []
    for m in re.finditer(r'<(/?)([a-zA-Z][\w-]*)((?:"[^"]*"|\'[^\']*\'|[^>"\'])*?)(/?)>', src):
        closing, tag, selfclose = m.group(1), m.group(2), m.group(4)
        if selfclose == '/': continue
        if closing == '/':
            if not stack or stack[-1] != tag:
                line = src[:m.start()].count('\n') + 1
                top = stack[-1] if stack else '空'
                print(f'❌ {f}:{line} </{tag}> 无匹配开始标签(栈顶:{top})'); fail = 1
                if stack and stack[-1] == tag: stack.pop()
            else:
                stack.pop()
        else:
            stack.append(tag)
    if stack:
        print(f'❌ {f}: 未闭合标签 {stack}'); fail = 1
sys.exit(1 if fail else 0)
PY
[ $? -ne 0 ] && FAIL=1

echo "== 7. 已删除符号残留 =="
for sym in engine\. training INIT_SEQ START_SEQ pendingCourse; do
  HITS=$(grep -rn "$sym" --include="*.js" --include="*.wxml" --include="*.json" . 2>/dev/null)
  [ -n "$HITS" ] && { echo "❌ 残留引用 [$sym]:"; echo "$HITS" | head -3; FAIL=1; }
done

if [ $FAIL -eq 0 ]; then echo "✅ 验收全部通过"; else echo "❌ 验收未通过"; exit 1; fi

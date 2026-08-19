# public/fonts

## `head-800.woff2` — 제목 전용 굵기 800 한 벌 (TASK-75)

**원본:** 나눔스퀘어 네오 ExtraBold (NanumSquare Neo ExtraBold) ·
Copyright © 2022 NAVER Corp. · Font Designed by Sandoll Inc.

**라이선스:** SIL Open Font License 1.1 (전문은 같은 폴더의 `OFL.txt`).
재배포·임베딩·수정(서브셋·형식 변환)이 허용되며, **폰트 파일 자체를 판매하는 것만** 금지된다.
폰트 바이너리의 `fsType` 은 `8`(Editable embedding)이라 임베딩 제한도 없다.

**이름을 바꾼 이유:** OFL 의 Reserved Font Name 조항 때문이다. 서브셋은 OFL 이 말하는
"Modified Version" 이라 **원래 이름을 그대로 달 수 없다.** 그래서 내부 패밀리 이름을
`DS Head` 로 바꿨다. 원저작자 표시는 지우는 것이 아니라 이 문서와 `OFL.txt` 가 맡는다.

**원본 TTF 를 커밋하지 않는다** — 2.16MB 이고 배포에 필요 없다. 다시 만들 일이 있으면
아래 명령을 쓴다 (`pip install fonttools brotli` 필요, 상시 의존성이 아니다 —
`scripts/render-icons.mjs` 가 playwright 를 상시로 두지 않는 것과 같은 판단).

```python
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = "NanumSquareNeo-dEb.ttf"          # 원본 ExtraBold
OUT = "public/fonts/head-800.woff2"

# KS X 1001 완성형 한글 2,350자 = EUC-KR 선두바이트 0xB0~0xC8 구간.
# **`euc_kr` 코덱으로 인코딩해 거르지 말 것** — CPython 의 `euc_kr` 은 cp949 확장까지
# 받아들여서 11,172자가 통째로 통과한다 (그러면 woff2 가 347KB 로 세 배가 된다).
ks = []
for lead in range(0xB0, 0xC9):
    for trail in range(0xA1, 0xFF):
        try: ch = bytes([lead, trail]).decode("euc_kr")
        except UnicodeDecodeError: continue
        if 0xAC00 <= ord(ch) <= 0xD7A3: ks.append(ord(ch))
latin = list(range(0x20, 0x7F)) + [0xB7, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026, 0x00B0]

opts = subset.Options(); opts.hinting = False; opts.notdef_outline = False
opts.layout_features = ["*"]; opts.flavor = "woff2"
font = subset.load_font(SRC, opts)
s = subset.Subsetter(options=opts)
s.populate(unicodes=[c for c in sorted(set(ks)) + latin if c in TTFont(SRC).getBestCmap()])
s.subset(font)

name = font["name"]                      # OFL RFN — 이름을 바꾼다
for rec in list(name.names):
    if rec.nameID in (1, 3, 4, 6, 16, 21):
        v = rec.toUnicode().replace("NanumSquare Neo", "DS Head").replace("나눔스퀘어 네오", "DS Head")
        name.setName(v, rec.nameID, rec.platformID, rec.platEncID, rec.langID)

subset.save_font(font, OUT, opts)
```

### 실측 (2026-08-19)

| 무엇 | 크기 |
| --- | --- |
| 원본 TTF (ExtraBold, 12,250 글리프) | 2,155,336 B (2.16 MB) |
| 완성형 전체 11,172자 woff2 | 355,780 B (347 KB) |
| **KS X 1001 2,350자 woff2 (채택)** | **114,752 B (112 KB)** |

**예산 게이트는 "한 벌 300KB" 였고 112KB 로 통과했다.** 완성형 전체로 가면 347KB 라
게이트를 넘는다 — **서브셋 범위를 넓히려면 이 표를 다시 재고 게이트부터 판단할 것.**

### 왜 한 벌뿐인가

굵기 800 은 시스템 한글 폰트에 아예 없어서 700 으로 떨어진다. 그 한 자리만 웹폰트로
메우고 **본문은 시스템 폰트 그대로**다 — 본문까지 얹으면 2,000자 스트리밍이 폰트 로드에
묶인다 (TASK-71 이 웹폰트를 뺀 이유가 그것이다).

`font-display: swap` 이라 폰트가 늦어도 글이 먼저 보인다.

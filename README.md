# Apple Music Replay 2025

2025년 가장 많이 들은 노래 인터랙티브 시각화 프로젝트

## 데이터

- `data/music_2025_with_covers.json` - 월별 최다 재생 곡 데이터
- `covers/` - 앨범 커버 이미지 (35개)

## 구조

```
├── data/
│   ├── music_2025.json          # 원본 데이터
│   └── music_2025_with_covers.json  # 커버 포함 데이터
├── covers/                      # 앨범 커버 이미지
├── scripts/
│   ├── ocr_extract.py          # OCR 데이터 추출
│   └── download_covers.py      # 앨범 커버 다운로드
└── README.md
```

## 데이터 포맷

```json
{
  "month": "2025-01",
  "month_label": "1월",
  "songs": [
    {
      "rank": 1,
      "title": "곡 제목",
      "artist": "아티스트",
      "plays": 22,
      "cover_url": "covers/파일명.jpg"
    }
  ]
}
```

## 출처

- 앨범 커버: iTunes API
- 데이터: Apple Music Replay 2025

#!/usr/bin/env python3
import os
import json
import re
from pathlib import Path
from PIL import Image
import pytesseract

IMAGE_DIR = Path("/Users/janghyuk/Desktop/image data")
OUTPUT_FILE = Path("/Users/janghyuk/workspace/apple-replay-2025/data/music_2025.json")

def extract_text_from_image(image_path):
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img, lang='kor+eng')
        return text
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return ""

def parse_music_data_v2(text):
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    songs = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        plays_match = re.search(r'(\d+)\s*회\s*재생', line)
        if plays_match:
            plays = int(plays_match.group(1))
            
            title_artist = re.sub(r'\d+\s*회\s*재생', '', line).strip()
            title_artist = re.sub(r'^\d+\s*', '', title_artist).strip()
            
            if title_artist and len(title_artist) > 1:
                parts = None
                for sep in [' - ', '—', '–', '-']:
                    if sep in title_artist:
                        parts = title_artist.split(sep, 1)
                        break
                
                if parts and len(parts) >= 2:
                    title = parts[0].strip()
                    artist = parts[1].strip()
                else:
                    title = title_artist
                    artist = ""
                    
                    for j in range(i + 1, min(i + 3, len(lines))):
                        next_line = lines[j]
                        if not re.search(r'\d+\s*회\s*재생', next_line) and len(next_line) > 1:
                            if not re.match(r'^[0-9]+$', next_line):
                                artist = next_line.strip()
                                break
                
                songs.append({
                    "title": title,
                    "artist": artist,
                    "plays": plays
                })
        
        i += 1
    
    return songs

def main():
    images = sorted(IMAGE_DIR.glob("*.png"))
    print(f"Found {len(images)} images")
    
    all_data = []
    month_map = {
        0: ("요약", "summary"),
        1: ("1월", "2025-01"),
        2: ("2월", "2025-02"),
        3: ("3월", "2025-03"),
        4: ("4월", "2025-04"),
        5: ("5월", "2025-05"),
        6: ("6월", "2025-06"),
        7: ("7월", "2025-07"),
        8: ("8월", "2025-08"),
        9: ("9월", "2025-09"),
        10: ("10월", "2025-10"),
        11: ("11월", "2025-11"),
        12: ("12월", "2025-12"),
    }
    
    for i, img_path in enumerate(images):
        print(f"\n{'='*50}")
        print(f"Processing {img_path.name}")
        
        text = extract_text_from_image(img_path)
        
        songs = parse_music_data_v2(text)
        
        if i == 0:
            month_label = "요약"
            month_id = "summary"
        elif i <= 12:
            month_label, month_id = month_map.get(i, (f"{i}월", f"2025-{i:02d}"))
        else:
            month_label = f"{i}월"
            month_id = f"2025-{i:02d}"
        
        print(f"Month: {month_label} ({month_id})")
        print(f"Found {len(songs)} songs:")
        for s in songs[:5]:
            print(f"  - {s['title']} | {s['artist']} | {s['plays']}회")
        
        all_data.append({
            "month": month_id,
            "month_label": month_label,
            "songs": songs,
            "image_file": img_path.name
        })
    
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*50}")
    print(f"Saved to {OUTPUT_FILE}")
    
    total_songs = sum(len(d['songs']) for d in all_data)
    print(f"Total: {total_songs} songs extracted")

if __name__ == "__main__":
    main()

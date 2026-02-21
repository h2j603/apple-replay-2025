#!/usr/bin/env python3
import json
import urllib.request
import urllib.parse
import os
from pathlib import Path

DATA_FILE = Path("/Users/janghyuk/workspace/apple-replay-2025/data/music_2025.json")
COVERS_DIR = Path("/Users/janghyuk/workspace/apple-replay-2025/covers")
OUTPUT_FILE = Path("/Users/janghyuk/workspace/apple-replay-2025/data/music_2025_with_covers.json")

def search_itunes(title, artist):
    query = f"{title} {artist}".strip()
    url = f"https://itunes.apple.com/search?term={urllib.parse.quote(query)}&media=music&limit=1"
    
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            if data['results']:
                result = data['results'][0]
                artwork_url = result.get('artworkUrl100', '')
                if artwork_url:
                    return artwork_url.replace('100x100', '600x600')
    except Exception as e:
        print(f"  Error searching iTunes: {e}")
    return None

def download_cover(url, filename):
    try:
        urllib.request.urlretrieve(url, filename)
        return True
    except Exception as e:
        print(f"  Error downloading: {e}")
        return False

def main():
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    COVERS_DIR.mkdir(parents=True, exist_ok=True)
    
    for month_data in data:
        month = month_data['month']
        print(f"\n{month_data['month_label']} ({month}):")
        
        for song in month_data['songs']:
            title = song['title']
            artist = song.get('artist', '')
            print(f"  Searching: {title} - {artist}")
            
            cover_url = search_itunes(title, artist)
            if cover_url:
                safe_title = "".join(c for c in title if c.isalnum() or c in ' -_')[:30]
                filename = f"{month}_{safe_title}.jpg"
                filepath = COVERS_DIR / filename
                
                if download_cover(cover_url, filepath):
                    song['cover_url'] = f"covers/{filename}"
                    song['cover_source'] = cover_url
                    print(f"    ✓ Downloaded: {filename}")
                else:
                    song['cover_url'] = None
            else:
                song['cover_url'] = None
                print(f"    ✗ Not found")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'='*50}")
    print(f"Saved to {OUTPUT_FILE}")
    
    total_covers = sum(1 for m in data for s in m['songs'] if s.get('cover_url'))
    total_songs = sum(len(m['songs']) for m in data)
    print(f"Downloaded {total_covers}/{total_songs} covers")

if __name__ == "__main__":
    main()

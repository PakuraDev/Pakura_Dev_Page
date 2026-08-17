#!/usr/bin/env python3
"""
Script de automatización para generar variantes optimizadas en escala de grises WebP (q=90).
"""
import os
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(BASE_DIR, "Assets")

VARIANTS = [
    ("PC-HD", 1.0),
    ("PC-SD", 0.75),
    ("Mobile-HD", 0.4),
    ("Mobile-SD", 0.25)
]

PATTERNS = ["Patron_1", "Patron_2"]

def main():
    print("=== Generando variantes optimizadas WebP ===")
    for name in PATTERNS:
        src_path = os.path.join(ASSETS_DIR, f"{name}-PC-HD.webp")
        if not os.path.exists(src_path):
            print(f"[!] No se encontró {src_path}")
            continue

        print(f"\nProcesando {name} desde {src_path}...")
        img = Image.open(src_path).convert("L") # Escala de grises (1 canal)
        orig_w, orig_h = img.size
        print(f"Dimensiones originales: {orig_w}x{orig_h}")

        for label, factor in VARIANTS:
            target_path = os.path.join(ASSETS_DIR, f"{name}-{label}.webp")
            if factor == 1.0:
                target_img = img
            else:
                nw = int(round(orig_w * factor))
                nh = int(round(orig_h * factor))
                target_img = img.resize((nw, nh), Image.Resampling.LANCZOS)

            target_img.save(target_path, "WEBP", quality=90, method=6)
            size_kb = os.path.getsize(target_path) / 1024
            print(f"  -> {label:10} ({target_img.width:4}x{target_img.height:4}) : {size_kb:.1f} KB")

    print("\n[OK] Proceso completado exitosamente.")

if __name__ == "__main__":
    main()

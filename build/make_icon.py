# Gera build/icon.png (512) e build/icon.ico: escudo dourado com mira, no fundo escuro do app.
# Uso: python build/make_icon.py
from pathlib import Path
from PIL import Image, ImageDraw

S = 1024  # desenha grande e reduz (antisserrilhado)
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=200, fill=(22, 20, 17, 255), outline=(232, 176, 74, 255), width=28)

# escudo
cx, top, bot, w = S // 2, 210, 840, 520
shield = [(cx - w // 2, top), (cx + w // 2, top), (cx + w // 2, 520), (cx, bot), (cx - w // 2, 520)]
d.polygon(shield, fill=(232, 176, 74, 255))
inner = [(cx - w // 2 + 60, top + 55), (cx + w // 2 - 60, top + 55), (cx + w // 2 - 60, 505), (cx, bot - 85), (cx - w // 2 + 60, 505)]
d.polygon(inner, fill=(22, 20, 17, 255))

# mira
cy, r = 500, 120
d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(232, 176, 74, 255), width=34)
for a, b in [((cx, cy - r - 70), (cx, cy - r + 40)), ((cx, cy + r - 40), (cx, cy + r + 70)),
             ((cx - r - 70, cy), (cx - r + 40, cy)), ((cx + r - 40, cy), (cx + r + 70, cy))]:
    d.line([a, b], fill=(232, 176, 74, 255), width=34)
d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(229, 96, 79, 255))

out = Path(__file__).parent
img.resize((512, 512), Image.LANCZOS).save(out / 'icon.png')
img.resize((256, 256), Image.LANCZOS).save(out / 'icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print('ok')

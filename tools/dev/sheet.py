import sys
from PIL import Image
# uso: sheet.py salida.jpg cols archivo1 archivo2 ...
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f) for f in files]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (w * cols, h * rows)); [S.paste(im, ((i % cols) * w, (i // cols) * h)) for i, im in enumerate(ims)]
S.save(out, quality=88)

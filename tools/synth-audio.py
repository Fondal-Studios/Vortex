#!/usr/bin/env python3
"""Banda sonora del video: música generativa + efectos sincronizados con el registro de eventos (events.json) de cada segmento.
Uso: python3 tools/synth-audio.py /tmp/claude-0/vid  → /tmp/claude-0/vid/audio.wav"""
import json, sys, os, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)
DIR = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/vid'
man = json.load(open(os.path.join(DIR, 'manifest.json')))
FPS = man['fps']
jobs = [j for j in man['jobs'] if os.path.exists(os.path.join(DIR, j['id'], 'events.json')) or os.path.isdir(os.path.join(DIR, j['id']))]
starts, t = {}, 0.0
for j in jobs:
    starts[j['id']] = t; t += j['frames'] / FPS
TOTAL = t + 1.0
N = int(TOTAL * SR)
sfx = np.zeros((N, 2), np.float32); mus = np.zeros((N, 2), np.float32)

def add(buf, t0, x, pan=0.0, gain=1.0):
    i = int(t0 * SR)
    if i >= N or i < 0: return
    x = x[: N - i]
    l = gain * (1 - max(0, pan)); r = gain * (1 + min(0, pan))
    buf[i:i + len(x), 0] += x * l; buf[i:i + len(x), 1] += x * r

def env(n, a=0.005, d=None):
    e = np.ones(n, np.float32); na = max(1, int(a * SR)); e[:na] = np.linspace(0, 1, na)
    d = d if d else n / SR; e *= np.exp(-np.arange(n) / SR / max(d, 1e-3) * 4)
    return e

def tone(f, dur, kind='sine', f2=None, vol=0.3, a=0.004):
    n = int(dur * SR); tt = np.arange(n) / SR
    fr = np.linspace(f, f2 if f2 else f, n) if f2 else np.full(n, f)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    if kind == 'sine': w = np.sin(ph)
    elif kind == 'tri': w = 2 / np.pi * np.arcsin(np.sin(ph))
    elif kind == 'saw': w = 2 * ((ph / (2 * np.pi)) % 1) - 1
    else: w = np.sign(np.sin(ph))
    return (w * env(n, a, dur) * vol).astype(np.float32)

def lowpass(x, k):
    k = max(1, int(k)); c = np.cumsum(np.insert(x, 0, 0)); y = (c[k:] - c[:-k]) / k
    return np.concatenate([np.full(k - 1, y[0]), y]).astype(np.float32) if len(y) else x

def noise(dur, vol=0.3, lp=40, hp=False):
    n = int(dur * SR); x = rng.standard_normal(n).astype(np.float32)
    y = lowpass(x, lp)
    if hp: y = x - y
    return y * vol

# ───────── música ─────────
SCALES = {'lyd': [0, 2, 4, 6, 7, 9, 11], 'phr': [0, 1, 4, 5, 7, 8, 10], 'min': [0, 2, 3, 5, 7, 8, 10]}
def music(t0, dur, scale, root, intensity=0.5, vol=1.0):
    sc = SCALES[scale]; end = t0 + dur
    # colchón
    for k, deg in enumerate([0, 4, 2, 5]):
        tt = t0 + k * dur / 4
        for off in (0, 7, 16):
            f = root * 2 ** ((sc[deg % 7] + off) / 12)
            n = int((dur / 4 + 1.5) * SR); x = np.zeros(n, np.float32)
            for det in (-0.4, 0, 0.4):
                x += tone(f * 2 ** (det / 100), dur / 4 + 1.5, 'saw', vol=0.05)
            x = lowpass(x, 40 + 60 * (1 - intensity)); w = np.minimum(1, np.minimum(np.arange(n) / (SR * 1.2), (n - np.arange(n)) / (SR * 1.2))).astype(np.float32)
            add(mus, tt, x * w, 0, vol * 0.8)
    # arpegio con eco
    step = 0.25 if intensity < 0.6 else 0.125
    t = t0
    while t < end:
        if rng.random() < 0.3 + 0.55 * intensity:
            deg = int(rng.integers(0, 10)); f = root * 4 * 2 ** ((sc[deg % 7] + 12 * (deg // 7)) / 12)
            x = pad2(tone(f, 0.6, 'tri', vol=0.12), tone(f * 2, 0.4, 'sine', vol=0.05))
            add(mus, t, x, float(rng.uniform(-0.5, 0.5)), vol)
            add(mus, t + 0.375, x * 0.45, float(rng.uniform(-0.8, 0.8)), vol); add(mus, t + 0.75, x * 0.2, float(rng.uniform(-0.8, 0.8)), vol)
        t += step
    # pulso grave
    if intensity > 0.3:
        t = t0
        while t < end:
            add(mus, t, tone(root * 1, 0.35, 'sine', f2=root * 0.8, vol=0.4 * intensity), 0, vol); t += 0.5 if intensity < 0.7 else 0.25

# ───────── efectos ─────────
def pad2(a, b):
    n = max(len(a), len(b)); o = np.zeros(n, np.float32); o[:len(a)] += a; o[:len(b)] += b; return o
def shot(w):
    if w == 0: return pad2(tone(1100, 0.12, 'tri', f2=300, vol=0.22), tone(2200, 0.08, 'sine', f2=900, vol=0.1))
    if w == 1: return pad2(noise(0.3, 0.5, 12), tone(160, 0.25, 'saw', f2=50, vol=0.35))
    if w == 2: return pad2(tone(700, 0.06, 'sq', f2=420, vol=0.12), noise(0.05, 0.12, 3, True))
    if w == 3: return pad2(tone(120, 0.4, 'saw', f2=40, vol=0.4), noise(0.35, 0.25, 30))
    return pad2(tone(2600, 0.5, 'sine', f2=120, vol=0.35), tone(1300, 0.6, 'tri', f2=60, vol=0.2))
def boom(): return pad2(noise(0.7, 0.8, 60), tone(90, 0.6, 'sine', f2=25, vol=0.6))
VOICES = {'astilla': lambda: tone(1800, 0.1, 'sq', f2=800, vol=0.1), 'geoda': lambda: pad2(tone(70, 0.5, 'saw', f2=45, vol=0.35), noise(0.4, 0.25, 50)),
          'prisma': lambda: tone(1200, 0.2, 'sine', f2=2400, vol=0.14), 'lente': lambda: tone(400, 0.45, 'sine', f2=1600, vol=0.18),
          'cuarzo': lambda: pad2(pad2(tone(330, 0.5, 'tri', vol=0.12), tone(392, 0.5, 'tri', vol=0.12)), tone(494, 0.5, 'tri', vol=0.12)),
          'racimo': lambda: tone(800, 0.08, 'sq', f2=1500, vol=0.1), 'graviton': lambda: tone(55, 1.2, 'sine', f2=300, vol=0.4),
          'coloso': lambda: pad2(tone(55, 1.2, 'saw', f2=30, vol=0.5), noise(1.0, 0.35, 80)), 'madre': lambda: pad2(tone(65, 1.4, 'saw', f2=40, vol=0.45), tone(130, 1.0, 'sine', f2=190, vol=0.25))}
def ui(kind):
    if kind == 'tick': return tone(1500, 0.04, 'sine', f2=1900, vol=0.12)
    if kind == 'ok': return pad2(tone(600, 0.12, 'tri', f2=1200, vol=0.2), np.concatenate([np.zeros(int(0.06 * SR), np.float32), tone(1200, 0.2, 'sine', vol=0.12)]))
    if kind == 'back': return tone(900, 0.12, 'tri', f2=450, vol=0.15)
    o = np.zeros(int(1.0 * SR), np.float32)
    for i, s in enumerate([0, 7, 12, 19]): x = tone(784 * 2 ** (s / 12), 0.4, 'sine', vol=0.14); o[int(i * 0.09 * SR): int(i * 0.09 * SR) + len(x)] += x[: len(o) - int(i * 0.09 * SR)]
    return o

def train(secs):
    n = int(secs * SR); x = rng.standard_normal(n).astype(np.float32)
    # ruido que se vuelve brillante y fuerte (filtro variable por tramos)
    out = np.zeros(n, np.float32); blk = SR // 10
    for i in range(0, n, blk):
        k = i / n; seg = x[i:i + blk]; out[i:i + blk] = lowpass(seg, 200 * (1 - k) + 2) * (0.03 + 1.0 * k ** 3)
    rumble = tone(38, secs, 'saw', vol=0.0) + 0
    thump = np.zeros(n, np.float32)
    for tt in np.arange(0, secs, 0.28 - 0.1 * np.linspace(0, 1, 1)[0]): pass
    out += (np.sin(2 * np.pi * np.cumsum(np.full(n, 42.0)) / SR) * (np.linspace(0, 1, n) ** 2) * 0.35).astype(np.float32)
    for frac in (0.55, 0.8):
        i = int(frac * secs * SR); horn = tone(311, 1.2, 'saw', vol=0.22, a=0.05) + tone(392, 1.2, 'saw', vol=0.22, a=0.05); out[i:i + len(horn)] += horn[: n - i]
    return out
def heartbeat(): return pad2(tone(60, 0.25, 'sine', f2=40, vol=0.6), np.concatenate([np.zeros(int(0.22 * SR), np.float32), tone(55, 0.25, 'sine', f2=38, vol=0.45)]))

# ───────── línea de tiempo ─────────
SEG_MUSIC = {  # id → (escala, raíz, intensidad)
    '01-titulo': ('lyd', 55, 0.35), '02-historia': ('min', 49, 0.2), '03-isla': ('lyd', 55, 0.8), '04-coloso': ('lyd', 55, 1.0),
    '05-fractal': ('phr', 49, 0.85), '06-madre': ('phr', 49, 1.0), '08-final': ('lyd', 55, 0.3)}
hit_t = -1
for j in jobs:
    t0 = starts[j['id']]; dur = j['frames'] / FPS
    key = j['id'] if j['id'] in SEG_MUSIC else ('07' if j['id'].startswith('07') else None)
    if key and key != '07':
        sc, root, inten = SEG_MUSIC[key]; music(t0, dur, sc, root, inten)
    elif key == '07':
        if not any(s['id'].startswith('07') for s in jobs if starts[s['id']] < t0): music(t0, sum(s['frames'] for s in jobs if s['id'].startswith('07')) / FPS, 'lyd', 55, 0.7)
    p = os.path.join(DIR, j['id'], 'events.json')
    ev = json.load(open(p)) if os.path.exists(p) else []
    last = {}
    for e in ev:
        m = e['m']; a = e.get('a', []); tt = t0 + e['t']
        if m == 'ui': add(sfx, tt, ui(a[0]), 0, 0.9)
        elif m == 'chirp': add(sfx, tt, tone(700 + (a[0] * 53) % 500, 0.07, 'sine', f2=(700 + (a[0] * 53) % 500) * (1.2 + (a[0] % 3) * 0.1), vol=0.12), 0.3, 1.0)
        elif m == 'train': add(sfx, tt, train(a[0] if a else 11), 0, 0.9)
        elif m == 'heartbeat': add(sfx, tt, heartbeat(), 0, 1.0)
        elif m == 'shot': add(sfx, tt, shot(a[0]), 0, 0.55)
        elif m == 'boom': add(sfx, tt, boom(), 0, 0.5)
        elif m == 'hit':
            if tt - last.get('hit', -1) > 0.05: add(sfx, tt, tone(900 + rng.uniform(0, 300), 0.05, 'tri', f2=400, vol=0.1), float(rng.uniform(-0.6, 0.6)), 0.5); last['hit'] = tt
        elif m == 'voice' and a and a[0] in VOICES: add(sfx, tt, VOICES[a[0]](), float(rng.uniform(-0.5, 0.5)), 0.7)
        elif m == 'hurt': add(sfx, tt, pad2(tone(200, 0.25, 'saw', f2=70, vol=0.3), noise(0.15, 0.2, 8)), 0, 0.8)
        elif m == 'pickup': add(sfx, tt, ui('trophy')[: int(0.5 * SR)], 0, 0.5)
        elif m == 'gravity': add(sfx, tt, tone(80, 0.8, 'sine', f2=600, vol=0.45), 0, 0.8)
        elif m == 'portal': add(sfx, tt, tone(300, 0.35, 'sine', f2=1500, vol=0.3), 0, 0.7)
        elif m == 'wave': [add(sfx, tt + i * 0.12, tone(110 * 2 ** (s / 12), 0.9, 'saw', vol=0.14, a=0.1), 0, 0.7) for i, s in enumerate([0, 7, 12, 19])]

# eco corto en la música y mezcla
def echo(x, d=0.33, fb=0.35, n=3):
    o = x.copy()
    for k in range(1, n + 1):
        s = int(d * SR * k); o[s:] += x[:-s] * (fb ** k)
    return o
mus = echo(mus) * 0.55
mix = mus + sfx
# fundido global (entrada y salida)
f = int(0.8 * SR); mix[:f] *= np.linspace(0, 1, f)[:, None]; mix[-f:] *= np.linspace(1, 0, f)[:, None]
peak = np.abs(mix).max() + 1e-9; mix = np.tanh(mix / peak * 1.6) * 0.9
out = (mix * 32767).astype(np.int16)
with wave.open(os.path.join(DIR, 'audio.wav'), 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('audio.wav', round(TOTAL, 1), 's')

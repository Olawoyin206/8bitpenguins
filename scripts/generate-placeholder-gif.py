from PIL import Image, ImageDraw

SIZE = 160
GRID = 24
PX = SIZE // GRID


def b(draw, x, y, w, h, color):
    draw.rectangle(
        [int(x * PX), int(y * PX), int((x + w) * PX - 1), int((y + h) * PX - 1)],
        fill=color,
    )


def draw_egg(draw, y_off=0):
    ox = 0
    oy = y_off

    egg_rows = [
        (9, 3, 6, "#8f5b12"),
        (8, 4, 8, "#c88f1f"),
        (7, 5, 10, "#efbf45"),
        (6.5, 6, 11, "#f5c958"),
        (6, 7, 12, "#e8b83f"),
        (6, 8, 12, "#d9a52f"),
        (6.5, 9, 11, "#c88f1f"),
        (7, 10, 10, "#b97a1a"),
        (8, 11, 8, "#a56717"),
        (9, 12, 6, "#8a4f12"),
    ]
    for x, y, w, c in egg_rows:
        b(draw, x + ox, y + oy, w, 1, c)

    # gold sheen/details
    b(draw, 10 + ox, 4 + oy, 3, 1, "#fce28b")
    b(draw, 9.5 + ox, 5 + oy, 3.5, 1, "#f7d674")
    b(draw, 9 + ox, 6 + oy, 3, 1, "#f2ca5e")
    b(draw, 8.8 + ox, 7 + oy, 2.6, 1, "#e9be49")
    b(draw, 12.8 + ox, 7.5 + oy, 2.8, 1, "#d79f33")

    # outline bands
    b(draw, 6.7 + ox, 6 + oy, 10.6, 0.2, "#3a2608")
    b(draw, 6.2 + ox, 8 + oy, 11.6, 0.2, "#3a2608")
    b(draw, 8.2 + ox, 11 + oy, 7.6, 0.2, "#3a2608")


def draw_text(draw):
    # chunky pixel text "8BIT PENGUIN"
    glyphs = {
        "8": ["11111", "10001", "11111", "10001", "10001", "10001", "11111"],
        "B": ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
        "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
        "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
        "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
        "E": ["11111", "10000", "11110", "10000", "10000", "10000", "11111"],
        "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
        "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
        "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
        " ": ["000", "000", "000", "000", "000", "000", "000"],
    }
    text = "8BIT PENGUIN"
    scale = 0.28
    width = sum((len((glyphs.get(ch, glyphs[" "]))[0]) + 1) * scale for ch in text) - scale
    x = (24 - width) / 2
    y = 13.6
    for shadow, color in [((0.12, 0.12), "#0f172acc"), ((0.05, 0), "#f8fafc"), ((0, 0), "#f8fafc")]:
        cx = x + shadow[0]
        cy = y + shadow[1]
        for raw in text:
            ch = raw.upper()
            patt = glyphs.get(ch, glyphs[" "])
            w = len(patt[0])
            for r, row in enumerate(patt):
                for c, bit in enumerate(row):
                    if bit == "1":
                        b(draw, cx + c * scale, cy + r * scale, scale, scale, color)
            cx += (w + 1) * scale


def frame(y_off):
    img = Image.new("RGBA", (SIZE, SIZE), "#5b0b1a")
    draw = ImageDraw.Draw(img)

    # crimson water background
    for y in range(16, 24):
        depth = (y - 16) / 8
        c = int(143 - 80 * depth)
        color = f"#{c:02x}{max(9, int(23 - 10 * depth)):02x}{max(23, int(48 - 25 * depth)):02x}"
        b(draw, 0, y, 24, 1, color)
    for x in range(1, 23):
        if x % 3 != 0:
            b(draw, x, 16, 1, 1, "#cf3658")
        if x % 5 == 0:
            b(draw, x, 17, 1, 1, "#b32645")

    draw_egg(draw, y_off=y_off)
    draw_text(draw)
    return img.convert("P", palette=Image.ADAPTIVE, colors=32)


def main():
    offsets = [0, -1, -2, -1]
    frames = [frame(o) for o in offsets]
    out = "mint-app/public/egg-bounce.gif"
    frames[0].save(
        out,
        save_all=True,
        append_images=frames[1:],
        duration=[110, 110, 110, 110],
        loop=0,
        disposal=2,
        optimize=True,
    )
    print(out)


if __name__ == "__main__":
    main()

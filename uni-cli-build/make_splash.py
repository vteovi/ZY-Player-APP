from PIL import Image

SRC = r"D:/WorkBuddy/ZY-Player-APP-main/unpackage/res/icons/1024x1024.png"
OUT = r"D:/WorkBuddy/ZY-Player-APP-main/android-package/simpleDemo/src/main/res/drawable/splash.png"

W, H = 1080, 1920
canvas = Image.new("RGB", (W, H), (255, 255, 255))

logo = Image.open(SRC).convert("RGBA")
size = 320
logo = logo.resize((size, size), Image.LANCZOS)
canvas.paste(logo, ((W - size) // 2, (H - size) // 2 - 120), logo)

canvas.save(OUT, "PNG")
print("splash saved:", OUT, canvas.size)

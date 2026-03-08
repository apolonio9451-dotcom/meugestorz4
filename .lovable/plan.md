

The user uploaded a new logo image (Meu_Gestor.jpg) and previously asked about changing the app icon for mobile. The last diff shows the icon-512.png was updated but appears to be empty/binary. Now the user has provided their actual logo image.

## Plan

1. **Copy the uploaded logo to public directory** as the app icon (`public/icon-512.png`) replacing the current file
2. **Also copy to public as favicon** for browser tab display
3. **Ensure index.html references are correct** (they already point to `/icon-512.png`)

This is a simple asset swap - copy `user-uploads://Meu_Gestor.jpg` to `public/icon-512.png` so it serves as both the favicon and mobile home screen icon.


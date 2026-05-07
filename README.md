# Material Symbol Favicon Generator

Generate custom favicons using Google's Material Design Icons with support for rounded icons, customizable colors, corner radius, and icon scale.

## Features

- **Material Icons:** Access to Google's extensive Material Symbols library
- **Rounded Styles:** Toggle between sharp and rounded icon variants
- **Custom Colors:** Choose background and icon colors with color pickers
- **Corner Radius:** Adjustable roundness for the background (0–256px)
- **Icon Scaling:** Resize icons from 0.6x to 1.6x
- **Multiple Formats:** Download as .ico or individual PNGs in a ZIP

---

**AI Developed:** This project was developed almost entirely by AI.

## Usage

Open `content/index.html` in a browser and use the controls on the left panel:

| Control          | Options                       | URL parampeter | Value Format (Example)     |
| ---------------- | ----------------------------- | -------------- | -------------------------- |
| Icon Name        | Material icon name            | `icon`         | string (e.g. `home`)       |
| Style Toggle     | Sharp / Rounded               | `style`        | `sharp` or `rounded`       |
| Background Color | Click color picker to choose  | `bg`           | hex string (e.g. `320984`) |
| Icon Color       | Click color picker to choose  | `fg`           | hex string (e.g. `FFFFFF`) |
| Corner Radius    | 0–256px slider                | `radius`       | number (e.g. `170`)        |
| Icon Scale       | 0.6–1.6x slider               | `scale`        | number (e.g. `1.3`)        |

## Example URL

Share your custom favicon configuration by opening the URL with parameters. This is how `content/favicon.ico` was generated:

```
https://sharko789.github.io/favicon-generator/?icon=home&style=rounded&bg=320984&fg=FFFFFF&radius=170&scale=1.3
```

## Deployment

### Production

Modify the default network in the `docker-compose.yml` to match your environment and configure your actual reverse proxy accordingly. Then run:

```bash
docker compose -f docker-compose.yml up -d
```

Or adapt the setup to your needs, it should be easy.

### Development (Port 5000)

Run on port 5000 without external network dependency:

```bash
docker compose -f docker-compose-dev.yml up -d
```

Access at `http://localhost:5000`.

### Local Usage

Simply open `content/index.html` in a browser. No server required.

## Acknowledgements

- **[Google Material Design Icons](https://fonts.google.com/icons)** — Icon library and source for all material symbols
- **[Pickr](https://github.com/Simonwep/pickr)** — Color picker library by Simon West(℅)
- **[JSZip](https://github.com/Stuk/jszip)** — JavaScript ZIP library for PNG packaging


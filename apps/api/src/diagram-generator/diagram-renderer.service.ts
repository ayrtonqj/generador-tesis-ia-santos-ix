import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

@Injectable()
export class DiagramRendererService {
  private readonly logger = new Logger(DiagramRendererService.name);

  async renderMermaidToSvg(mermaidDefinition: string): Promise<string | null> {
    if (!mermaidDefinition) return null;
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      try {
        const page = await browser.newPage();
        const html = this.buildMermaidHtml(mermaidDefinition);
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const svg = await page.evaluate(() => {
          const svgEl = document.querySelector('.mermaid svg');
          return svgEl ? svgEl.outerHTML : null;
        });

        return svg;
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      this.logger.warn(`Error rendering Mermaid to SVG: ${err.message}`);
      return null;
    }
  }

  private async captureScreenshot(page: any): Promise<Buffer | null> {
    const dimensions = await page.evaluate(() => {
      const svg = document.querySelector('.mermaid svg') as SVGSVGElement;
      if (!svg) return null;
      svg.style.overflow = 'visible';
      svg.style.maxWidth = 'none';
      const rect = svg.getBoundingClientRect();
      return {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        x: Math.floor(rect.x),
        y: Math.floor(rect.y),
      };
    });
    if (!dimensions) return null;

    const pad = 40;
    const buffer = await page.screenshot({
      clip: {
        x: Math.max(0, dimensions.x - pad),
        y: Math.max(0, dimensions.y - pad),
        width: dimensions.width + pad * 2,
        height: dimensions.height + pad * 2,
      },
      type: 'png',
    });
    return Buffer.from(buffer);
  }

  async renderMermaidToPng(mermaidDefinition: string): Promise<Buffer | null> {
    if (!mermaidDefinition) return null;
    try {
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 4000, height: 3000 });
        const html = this.buildMermaidHtml(mermaidDefinition);
        await page.setContent(html, { waitUntil: 'networkidle0' });
        return await this.captureScreenshot(page);
      } finally {
        await browser.close();
      }
    } catch (err: any) {
      this.logger.warn(`Error rendering Mermaid to PNG: ${err.message}`);
      return null;
    }
  }

  async renderMultipleToPng(definitions: Record<string, string>): Promise<Record<string, Buffer | null>> {
    const results: Record<string, Buffer | null> = {};
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      for (const [key, def] of Object.entries(definitions)) {
        if (!def) { results[key] = null; continue; }
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: 4000, height: 3000 });
          const html = this.buildMermaidHtml(def);
          await page.setContent(html, { waitUntil: 'networkidle0' });
          results[key] = await this.captureScreenshot(page);
          await page.close();
        } catch (err: any) {
          this.logger.warn(`Error rendering diagram '${key}': ${err.message}`);
          results[key] = null;
        }
      }
    } finally {
      await browser.close();
    }
    return results;
  }

  private buildMermaidHtml(mermaidDefinition: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'default',
      securityLevel: 'loose',
      themeVariables: {
        fontSize: '20px',
        primaryFontFamily: 'Arial, sans-serif',
        primaryTextColor: '#1F2937',
      },
    });
  </script>
  <style>
    body { margin: 0; display: flex; justify-content: center; }
    .mermaid { max-width: none; }
    .mermaid svg { max-width: none; }
  </style>
</head>
<body>
  <pre class="mermaid">
${mermaidDefinition}
  </pre>
</body>
</html>`;
  }
}

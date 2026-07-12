declare module 'html-to-docx' {
  interface DocxOptions {
    margins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
      header?: number;
      footer?: number;
      gutter?: number;
    };
    font?: string;
    fontSize?: number;
    complexScriptFontSize?: number;
    decodeUnicode?: boolean;
    orientation?: 'portrait' | 'landscape';
    [key: string]: any;
  }
  function HTMLtoDOCX(
    html: string,
    headerHTMLString?: string | null,
    options?: DocxOptions,
    footerHTMLString?: string | null
  ): Promise<Buffer>;
  export = HTMLtoDOCX;
}

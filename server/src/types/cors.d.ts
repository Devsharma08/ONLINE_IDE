declare module "cors" {
  import type { RequestHandler } from "express";

  type StaticOrigin = boolean | string | RegExp | Array<boolean | string | RegExp>;
  type CustomOrigin = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => void;

  type CorsOptions = {
    origin?: StaticOrigin | CustomOrigin;
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
    optionsSuccessStatus?: number;
  };

  const cors: (options?: CorsOptions) => RequestHandler;

  export default cors;
}

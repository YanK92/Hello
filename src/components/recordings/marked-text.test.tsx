import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkedText } from "./marked-text";

describe("MarkedText", () => {
  it("turns <mark> pairs into elements", () => {
    expect(renderToStaticMarkup(<MarkedText text="book an <mark>inspection</mark> today" />)).toBe(
      "book an <mark>inspection</mark> today",
    );
  });

  it("escapes any other markup in the transcript", () => {
    expect(renderToStaticMarkup(<MarkedText text={'<img src=x onerror="alert(1)"> <mark>hi</mark>'} />)).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <mark>hi</mark>",
    );
  });
});

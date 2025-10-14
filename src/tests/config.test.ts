// Tests for the configuration functions in config.ts
// These tests verify that the createExtensionMap function works correctly

import { describe, expect, it } from "bun:test";
import { createExtensionMap } from "../config";
import type { OrganizerConfig } from "../types";

describe("createExtensionMap", () => {
  it("should create a correct map from a standard categories object", () => {
    const categories: OrganizerConfig["categories"] = {
      images: {
        extensions: [".png", ".jpg", ".jpeg"],
        targetDir: "media/images",
      },
      documents: {
        extensions: [".pdf", ".docx"],
        targetDir: "docs",
      },
    };

    const expectedMap = {
      ".png": "media/images",
      ".jpg": "media/images",
      ".jpeg": "media/images",
      ".pdf": "docs",
      ".docx": "docs",
    };

    const actualMap = createExtensionMap(categories);
    expect(actualMap).toEqual(expectedMap);
  });

  it("should handle categories with empty extension arrays", () => {
    const categories: OrganizerConfig["categories"] = {
      images: {
        extensions: [".png"],
        targetDir: "media/images",
      },
      empty: {
        extensions: [],
        targetDir: "empty_folder",
      },
    };

    const expectedMap = {
      ".png": "media/images",
    };

    const actualMap = createExtensionMap(categories);
    expect(actualMap).toEqual(expectedMap);
  });

  it("should correctly handle case variations in extensions", () => {
    const categories: OrganizerConfig["categories"] = {
      images: {
        extensions: [".PNG", ".JpG"],
        targetDir: "pictures",
      },
    };

    const expectedMap = {
      ".png": "pictures",
      ".jpg": "pictures",
    };

    const actualMap = createExtensionMap(categories);
    expect(actualMap).toEqual(expectedMap);
  });

  it("should return an empty object when the categories object is empty", () => {
    const categories: OrganizerConfig["categories"] = {};
    const expectedMap = {};
    const actualMap = createExtensionMap(categories);
    expect(actualMap).toEqual(expectedMap);
  });
});

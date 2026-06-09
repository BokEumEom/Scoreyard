// src/core/dom.js — the game canvas and its 2D drawing context.
// Shared so render/loop modules can draw without re-querying the DOM.
export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");

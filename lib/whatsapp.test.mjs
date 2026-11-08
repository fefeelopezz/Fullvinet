import assert from "node:assert/strict";
import { test } from "node:test";
import { dueDate, noticeFor, noticeParams, normalizePhone, reminderLink, reminderText } from "./whatsapp.ts";

test("arma el mensaje del botón Avisar", () => {
  assert.match(reminderText("Ana", "2026-11-01", 95000, "2026-11-08"), /^Hola Ana, .*noviembre de 2026 por .*95\.000 vence el 30 de noviembre\./);
  assert.match(reminderText("Ana", "2026-11-01", 95000, "2026-11-30"), / vence hoy\./);
  assert.match(reminderText("Ana", "2026-10-01", 95000, "2026-11-08"), / venció el 30 de octubre\./);
  assert.equal(reminderLink("5491123456789", "a b"), "https://wa.me/5491123456789?text=a%20b");
  assert.equal(reminderLink(null, "a b"), "https://wa.me/?text=a%20b");
});

test("normaliza números argentinos", () => {
  assert.equal(normalizePhone("11 2345-6789"), "5491123456789");
  assert.equal(normalizePhone("011 2345 6789"), "5491123456789");
  assert.equal(normalizePhone("+54 9 351 456 7890"), "5493514567890");
  assert.equal(normalizePhone("+54 351 456 7890"), "5493514567890");
  assert.equal(normalizePhone("11 15 2345 6789"), null);
  assert.equal(normalizePhone("1234"), null);
});

test("vence el 30, o el último día en febrero", () => {
  assert.equal(dueDate("2026-11-01"), "2026-11-30");
  assert.equal(dueDate("2026-02-01"), "2026-02-28");
  assert.equal(dueDate("2028-02-01"), "2028-02-29");
});

test("avisa 3 días antes y el día del vencimiento", () => {
  assert.equal(noticeFor("2026-11-01", "2026-11-26"), null);
  assert.equal(noticeFor("2026-11-01", "2026-11-27"), "antes");
  assert.equal(noticeFor("2026-11-01", "2026-11-29"), "antes");
  assert.equal(noticeFor("2026-11-01", "2026-11-30"), "vencimiento");
  assert.equal(noticeFor("2026-11-01", "2026-12-01"), null);
  assert.equal(noticeFor("2026-10-01", "2026-11-27"), null);
});

test("arma los datos del mensaje", () => {
  const [name, month, money, when] = noticeParams("antes", "Ana", "2026-11-01", 95000);
  assert.equal(name, "Ana");
  assert.match(month, /noviembre/);
  assert.match(money, /95\.000/);
  assert.match(when, /30 de noviembre/);
  assert.equal(noticeParams("vencimiento", "Ana", "2026-11-01", 95000)[3], "hoy");
});

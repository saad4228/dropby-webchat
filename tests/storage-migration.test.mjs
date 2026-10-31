import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

test("Supabase default migration preserves every attachment field and its message reference", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle")
      .filter((f) => /^000[0-5]_.*\.sql$/.test(f))
      .sort())
      db.exec(readFileSync("drizzle/" + file, "utf8"));
    db.prepare(
      "INSERT INTO attachments(id,roomId,senderId,name,mime,size,created,provider,storagePath,purpose,state,expectedSize,expires,thumbnailId,parentId,duration,waveform,deletedAt,resumableUrl) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      "kept-file",
      "room",
      "author",
      "photo.webp",
      "image/webp",
      1024,
      10,
      "supabase",
      "private/path",
      "chat",
      "attached",
      1024,
      100,
      "preview",
      null,
      3.5,
      "[0.2,0.8]",
      null,
      "https://storage.invalid/transfer",
    );
    db.prepare(
      "INSERT INTO messages(id,roomId,senderId,text,attachmentId,created) VALUES(?,?,?,?,?,?)",
    ).run("message", "room", "author", "Keep this attachment", "kept-file", 11);
    const before = db
      .prepare("SELECT * FROM attachments WHERE id='kept-file'")
      .get();
    db.exec(readFileSync("drizzle/0006_optimal_masque.sql", "utf8"));
    assert.deepEqual(
      db.prepare("SELECT * FROM attachments WHERE id='kept-file'").get(),
      before,
    );
    assert.equal(
      db
        .prepare(
          "SELECT a.id FROM attachments a JOIN messages m ON m.attachmentId=a.id WHERE m.id='message'",
        )
        .get().id,
      "kept-file",
    );
    db.exec(
      "INSERT INTO attachments(id,roomId,senderId,name,mime,size,created) VALUES('new-file','room','author','new.txt','text/plain',1,12)",
    );
    assert.equal(
      db.prepare("SELECT provider FROM attachments WHERE id='new-file'").get()
        .provider,
      "supabase",
    );
  } finally {
    db.close();
  }
});

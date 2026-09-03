CREATE TABLE "push_subscription" (
  "id" SERIAL NOT NULL,
  "pengguna_id" INTEGER NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "dibuat_pada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "diubah_pada" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");
CREATE INDEX "push_subscription_pengguna_id_idx" ON "push_subscription"("pengguna_id");

ALTER TABLE "push_subscription"
ADD CONSTRAINT "push_subscription_pengguna_id_fkey"
FOREIGN KEY ("pengguna_id") REFERENCES "pengguna"("id") ON DELETE CASCADE ON UPDATE CASCADE;

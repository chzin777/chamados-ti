/*
  Warnings:

  - You are about to drop the `item` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "item";

-- CreateTable
CREATE TABLE "ticket" (
    "id" SERIAL NOT NULL,
    "requester" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

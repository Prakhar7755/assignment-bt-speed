import dotenv from "dotenv";
dotenv.config();
import express from "express";
import pkg from "@prisma/client";
const { PrismaClient, LinkPrecedence } = pkg;

const app = express();
const prisma = new PrismaClient();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("API running");
});

app.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "Email or phoneNumber required" });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const matches = await tx.contact.findMany({
        where: {
          deletedAt: null,
          OR: [
            { email: email ?? undefined },
            { phoneNumber: phoneNumber ?? undefined },
          ],
        },
      });

      if (matches.length === 0) {
        const newContact = await tx.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: LinkPrecedence.primary,
          },
        });

        return {
          primaryContatctId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
          secondaryContactIds: [],
        };
      }

      const primaryIds = new Set();

      matches.forEach((c) => {
        if (c.linkPrecedence === "primary") primaryIds.add(c.id);
        else if (c.linkedId) primaryIds.add(c.linkedId);
      });

      const primaries = await tx.contact.findMany({
        where: { id: { in: Array.from(primaryIds) } },
      });

      primaries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const oldestPrimary = primaries[0];

      for (let i = 1; i < primaries.length; i++) {
        await tx.contact.update({
          where: { id: primaries[i].id },
          data: {
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: oldestPrimary.id,
          },
        });
      }

      const cluster = await tx.contact.findMany({
        where: {
          OR: [{ id: oldestPrimary.id }, { linkedId: oldestPrimary.id }],
        },
      });

      const existingEmails = new Set(
        cluster.map((c) => c.email).filter(Boolean),
      );
      const existingPhones = new Set(
        cluster.map((c) => c.phoneNumber).filter(Boolean),
      );

      if (
        (email && !existingEmails.has(email)) ||
        (phoneNumber && !existingPhones.has(phoneNumber))
      ) {
        const newSecondary = await tx.contact.create({
          data: {
            email,
            phoneNumber,
            linkPrecedence: LinkPrecedence.secondary,
            linkedId: oldestPrimary.id,
          },
        });

        cluster.push(newSecondary);
      }

      const primary =
        cluster.find((c) => c.id === oldestPrimary.id) || oldestPrimary;
      const secondaries = cluster.filter(
        (c) => c.linkPrecedence === "secondary",
      );

      const emails = [primary.email, ...secondaries.map((c) => c.email)].filter(
        Boolean,
      );

      const phoneNumbers = [
        primary.phoneNumber,
        ...secondaries.map((c) => c.phoneNumber),
      ].filter(Boolean);

      return {
        primaryContatctId: primary.id,
        emails: [...new Set(emails)],
        phoneNumbers: [...new Set(phoneNumbers)],
        secondaryContactIds: secondaries.map((c) => c.id),
      };
    });

    return res.status(200).json({ contact: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(3000, () => console.log("Server running"));

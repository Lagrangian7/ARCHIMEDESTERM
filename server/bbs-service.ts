import { db } from "./db";
import { bbsSystems, bbsConnections, bbsFavorites, virtualSystems } from "@shared/schema";
import type { BbsSystem, InsertBbsSystem, InsertBbsConnection, VirtualSystem } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export class BbsService {
  // Get all active BBS systems
  async getAllBbsSystems(): Promise<BbsSystem[]> {
    return await db.select().from(bbsSystems).where(eq(bbsSystems.isActive, true));
  }

  // Get BBS systems by category
  async getBbsByCategory(category: string): Promise<BbsSystem[]> {
    return await db
      .select()
      .from(bbsSystems)
      .where(
        and(
          eq(bbsSystems.isActive, true),
          sql`${bbsSystems.categories} @> ARRAY[${category}]::text[]`
        )
      );
  }

  // Search BBS systems
  async searchBbsSystems(query: string): Promise<BbsSystem[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    return await db
      .select()
      .from(bbsSystems)
      .where(
        and(
          eq(bbsSystems.isActive, true),
          sql`(
            LOWER(${bbsSystems.name}) LIKE ${searchTerm} OR
            LOWER(${bbsSystems.description}) LIKE ${searchTerm} OR
            LOWER(${bbsSystems.location}) LIKE ${searchTerm}
          )`
        )
      );
  }

  // Get BBS system by host and port
  async getBbsByAddress(host: string, port: string): Promise<BbsSystem | undefined> {
    const result = await db
      .select()
      .from(bbsSystems)
      .where(and(eq(bbsSystems.host, host), eq(bbsSystems.port, port)))
      .limit(1);
    
    return result[0];
  }

  // Record a connection
  async recordConnection(data: InsertBbsConnection): Promise<void> {
    await db.insert(bbsConnections).values(data);
  }

  // End a connection
  async endConnection(sessionId: string, duration: number, bytesTransmitted: number): Promise<void> {
    await db
      .update(bbsConnections)
      .set({
        endTime: new Date(),
        duration: duration.toString(),
        bytesTransmitted: bytesTransmitted.toString(),
        isActive: false,
      })
      .where(eq(bbsConnections.sessionId, sessionId));
  }

  // Get user's favorite BBS systems
  async getUserFavorites(userId: string): Promise<BbsSystem[]> {
    const result = await db
      .select({
        bbs: bbsSystems,
      })
      .from(bbsFavorites)
      .innerJoin(bbsSystems, eq(bbsFavorites.bbsId, bbsSystems.id))
      .where(eq(bbsFavorites.userId, userId));

    return result.map(r => r.bbs);
  }

  // Add BBS to favorites
  async addToFavorites(userId: string, bbsId: string, nickname?: string): Promise<void> {
    await db.insert(bbsFavorites).values({
      userId,
      bbsId,
      nickname,
    });
  }

  // Get popular BBS systems
  async getPopularBbsSystems(limit: number = 10): Promise<BbsSystem[]> {
    return await db
      .select()
      .from(bbsSystems)
      .where(eq(bbsSystems.isActive, true))
      .orderBy(desc(bbsSystems.totalConnections))
      .limit(limit);
  }

  // Initialize database with starter BBS systems
  async initializeStarterData(): Promise<void> {
    const existingSystems = await db.select().from(bbsSystems).limit(1);
    if (existingSystems.length > 0) {
      return; // Already initialized
    }

    const starterBbsSystems: InsertBbsSystem[] = [
      {
        name: "Level 29",
        description: "A multi-user vintage BBS experience featuring door games, message areas, and file libraries",
        host: "level29.org", 
        port: "23",
        phoneNumber: "(XXX) XXX-XXXX",
        location: "Ontario, Canada",
        sysopName: "The Sysop",
        software: "Mystic BBS",
        nodes: "10",
        features: ["telnet", "web", "ssh"],
        categories: ["General", "Games", "Programming"],
        establishedYear: "2017",
      },
      {
        name: "Boondocks BBS",
        description: "Relive the glory days of BBSing with classic door games and forums",
        host: "bbs.boondocksbbs.com",
        port: "23", 
        phoneNumber: "(XXX) XXX-XXXX",
        location: "United States",
        software: "Synchronet",
        features: ["telnet"],
        categories: ["General", "Games", "Retro"],
        establishedYear: "2020",
      },
      {
        name: "Skull Island BBS",
        description: "Adventure awaits on Skull Island - games, files, and classic BBS fun",
        host: "skullislandbbs.com",
        port: "23",
        location: "United States", 
        software: "Mystic BBS",
        features: ["telnet"],
        categories: ["Games", "Adventure", "Files"],
        establishedYear: "2018",
      },
      {
        name: "Haunting The Chapel",
        description: "Gothic themed BBS with dark atmosphere and classic door games",
        host: "hauntingthechapel.com",
        port: "23",
        location: "United States",
        software: "Synchronet",
        features: ["telnet"],
        categories: ["Gothic", "Games", "Art"],
        establishedYear: "2019",
      },
      {
        name: "Castle Rock BBS",
        description: "Stephen King themed BBS with horror games and fiction areas",
        host: "castlerockbbs.com", 
        port: "23",
        location: "United States",
        software: "Mystic BBS",
        features: ["telnet", "web"],
        categories: ["Horror", "Fiction", "Games"],
        establishedYear: "2020",
      }
    ];

    await db.insert(bbsSystems).values(starterBbsSystems);
    console.log(`Initialized ${starterBbsSystems.length} starter BBS systems`);
  }

  // Get virtual systems for simulation
  async getVirtualSystems(): Promise<VirtualSystem[]> {
    return await db.select().from(virtualSystems).where(eq(virtualSystems.isActive, true));
  }

  // Initialize virtual network systems
  async initializeVirtualSystems(): Promise<void> {
    const existingSystems = await db.select().from(virtualSystems).limit(1);
    if (existingSystems.length > 0) {
      return; // Already initialized
    }

    const virtualSystemsData = [
      {
        name: "UNIX System V",
        hostname: "unix.archimedes.net",
        systemType: "unix",
        description: "Classic UNIX System V with vintage utilities and games",
        welcomeMessage: "Welcome to UNIX System V\nLogin: ",
        motd: "System V UNIX - A Multi-User System\n\nLast backup: Never\nCurrent users: 1\n\nEnjoy your session!",
        fileSystem: {
          "/": {
            "bin": { "ls": "executable", "cat": "executable", "who": "executable" },
            "usr": {
              "games": { "adventure": "executable", "trek": "executable" }
            },
            "home": {
              "guest": { "readme.txt": "Welcome to the system!" }
            }
          }
        },
        commands: ["ls", "cat", "who", "ps", "cd", "pwd", "help"],
        programs: ["adventure", "trek", "fortune"],
        networks: ["arpanet", "uucp"]
      },
      {
        name: "VAX/VMS System", 
        hostname: "vms.archimedes.net",
        systemType: "vms",
        description: "Digital Equipment Corporation VAX running VMS",
        welcomeMessage: "VAX/VMS V5.5-2 on node ARCHIMEDES\n\nUsername: ",
        motd: "%SYSTEM-I-LOGGEDOUT, user SYSTEM logged out at  8-DEC-2024 16:30:15.23\n\nWelcome to VAX/VMS\n",
        fileSystem: {
          "[SYSMGR]": {
            "LOGIN.COM": "$ SET DEFAULT SYS$LOGIN",
            "STARTUP.COM": "$ @SYS$MANAGER:SYSTARTUP_VMS"
          },
          "[GUEST]": {
            "NOTES.TXT": "Welcome to the VAX system"
          }
        },
        commands: ["DIR", "TYPE", "SHOW", "SET", "HELP"],
        programs: ["MAIL", "EVE", "CALC"],
        networks: ["decnet", "ethernet"]
      },
      {
        name: "CP/M System",
        hostname: "cpm.archimedes.net", 
        systemType: "cpm",
        description: "8-bit CP/M system with vintage software",
        welcomeMessage: "CP/M 2.2\n\nA>",
        motd: "CP/M Operating System\n64K System\n\nReady for commands.",
        fileSystem: {
          "A:": {
            "PIP.COM": "executable",
            "STAT.COM": "executable", 
            "WORDSTAR.COM": "executable",
            "BASIC.COM": "executable"
          }
        },
        commands: ["DIR", "PIP", "STAT", "TYPE"],
        programs: ["WORDSTAR", "BASIC", "MBASIC"],
        networks: []
      }
    ];

    await db.insert(virtualSystems).values(virtualSystemsData);
    console.log(`Initialized ${virtualSystemsData.length} virtual systems`);
  }
}

import { db } from './db';
import { virtualSystems, networkConnections } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface VirtualSystemConfig {
  name: string;
  hostname: string;
  systemType: 'unix' | 'vms' | 'dos' | 'bbs' | 'mainframe';
  welcomeMessage: string;
  motd: string;
  fileSystem: Record<string, any>;
  commands: string[];
  programs: Array<{ name: string; description: string; executable: string }>;
}

// Predefined virtual systems
const DEFAULT_SYSTEMS: VirtualSystemConfig[] = [
  {
    name: 'VAX/VMS System',
    hostname: 'vax.archimedes.local',
    systemType: 'vms',
    welcomeMessage: 'Welcome to VAX/VMS Version 7.3\nUsername: ',
    motd: 'Last login: Mon Jan 13 2025 14:30:22\nYou have 3 new messages.',
    fileSystem: {
      'SYS$SYSTEM': {
        'STARTUP.COM': 'VMS startup script',
        'LOGIN.COM': 'User login script'
      },
      'USER': {
        'ARCHIMEDES': {
          'NOTES.TXT': 'Personal notes file'
        }
      }
    },
    commands: ['DIR', 'TYPE', 'SHOW', 'SET', 'HELP', 'LOGOUT', 'MAIL'],
    programs: [
      { name: 'FORTRAN', description: 'Fortran compiler', executable: 'FOR' },
      { name: 'MAIL', description: 'VMS Mail system', executable: 'MAIL' }
    ]
  },
  {
    name: 'Unix Mainframe',
    hostname: 'unix.archimedes.local',
    systemType: 'unix',
    welcomeMessage: 'SunOS 4.1.4 (archimedes)\nlogin: ',
    motd: 'Welcome to the ARCHIMEDES Unix System\nSystem load: 0.15, 0.10, 0.05',
    fileSystem: {
      '/home/user': {
        '.profile': 'Shell configuration',
        'readme.txt': 'Welcome to Unix!'
      },
      '/usr/local/bin': {
        'fortune': 'Fortune cookie program'
      }
    },
    commands: ['ls', 'cd', 'cat', 'pwd', 'man', 'grep', 'vi', 'who', 'finger'],
    programs: [
      { name: 'cc', description: 'C compiler', executable: '/usr/bin/cc' },
      { name: 'fortune', description: 'Random quote generator', executable: '/usr/games/fortune' }
    ]
  },
  {
    name: 'MS-DOS 6.22',
    hostname: 'dos.archimedes.local',
    systemType: 'dos',
    welcomeMessage: 'MS-DOS Version 6.22\nC:\\>',
    motd: '',
    fileSystem: {
      'C:': {
        'AUTOEXEC.BAT': '@ECHO OFF\nPROMPT $P$G',
        'CONFIG.SYS': 'DEVICE=HIMEM.SYS',
        'DOS': {
          'COMMAND.COM': 'Command interpreter',
          'FORMAT.COM': 'Disk formatter'
        }
      }
    },
    commands: ['DIR', 'CD', 'TYPE', 'COPY', 'DEL', 'FORMAT', 'EDIT', 'MEM'],
    programs: [
      { name: 'QBASIC', description: 'QBasic interpreter', executable: 'C:\\DOS\\QBASIC.EXE' },
      { name: 'EDIT', description: 'Text editor', executable: 'C:\\DOS\\EDIT.COM' }
    ]
  }
];

export class VirtualSystemService {
  // Initialize default virtual systems
  async seedDefaultSystems() {
    for (const system of DEFAULT_SYSTEMS) {
      const existing = await db.query.virtualSystems.findFirst({
        where: eq(virtualSystems.hostname, system.hostname)
      });

      if (!existing) {
        await db.insert(virtualSystems).values({
          name: system.name,
          hostname: system.hostname,
          systemType: system.systemType,
          welcomeMessage: system.welcomeMessage,
          motd: system.motd,
          fileSystem: system.fileSystem,
          commands: system.commands,
          programs: system.programs,
          isActive: true
        });
      }
    }
  }

  // Execute command on virtual system
  async executeCommand(hostname: string, command: string, args: string[]): Promise<string> {
    const system = await db.query.virtualSystems.findFirst({
      where: eq(virtualSystems.hostname, hostname)
    });

    if (!system || !system.isActive) {
      return 'System not found or inactive';
    }

    const cmd = command.toUpperCase();
    const availableCommands = system.commands as string[];

    if (!availableCommands.includes(cmd) && !availableCommands.includes(command.toLowerCase())) {
      return `Command not found: ${command}`;
    }

    // Simulate command execution based on system type
    switch (system.systemType) {
      case 'vms':
        return this.executeVMSCommand(system, cmd, args);
      case 'unix':
        return this.executeUnixCommand(system, command.toLowerCase(), args);
      case 'dos':
        return this.executeDOSCommand(system, cmd, args);
      default:
        return 'System type not supported';
    }
  }

  private executeVMSCommand(system: any, cmd: string, args: string[]): string {
    const fs = system.fileSystem as Record<string, any>;
    
    switch (cmd) {
      case 'DIR':
        const dir = args[0] || 'SYS$SYSTEM';
        if (fs[dir]) {
          return `Directory ${dir}\n\n` + 
            Object.keys(fs[dir]).map(f => `${f.padEnd(20)} 1 KB`).join('\n');
        }
        return `Directory not found: ${dir}`;
      
      case 'SHOW':
        if (args[0] === 'SYSTEM') {
          return `OpenVMS V7.3 on node ${system.hostname}\nUptime: 47 days 13:45:22`;
        }
        return 'Invalid SHOW command';
      
      case 'TYPE':
        const file = args[0];
        // Traverse filesystem to find file
        for (const [dirName, dirContents] of Object.entries(fs)) {
          if (typeof dirContents === 'object' && file in dirContents) {
            return dirContents[file];
          }
        }
        return `File not found: ${file}`;
      
      default:
        return `${cmd} command executed successfully`;
    }
  }

  private executeUnixCommand(system: any, cmd: string, args: string[]): string {
    const fs = system.fileSystem as Record<string, any>;
    
    switch (cmd) {
      case 'ls':
        const path = args[0] || '/home/user';
        if (fs[path]) {
          return Object.keys(fs[path]).join('  ');
        }
        return `ls: cannot access '${path}': No such file or directory`;
      
      case 'pwd':
        return '/home/user';
      
      case 'cat':
        const file = args[0];
        for (const [dirPath, dirContents] of Object.entries(fs)) {
          if (typeof dirContents === 'object' && file in dirContents) {
            return dirContents[file];
          }
        }
        return `cat: ${file}: No such file or directory`;
      
      case 'who':
        return 'archimedes  tty1     Jan 13 14:30';
      
      case 'fortune':
        const fortunes = [
          'The best way to predict the future is to invent it.',
          'In the land of the blind, the one-eyed man is king.',
          'Time flies like an arrow; fruit flies like a banana.'
        ];
        return fortunes[Math.floor(Math.random() * fortunes.length)];
      
      default:
        return `${cmd}: command executed`;
    }
  }

  private executeDOSCommand(system: any, cmd: string, args: string[]): string {
    const fs = system.fileSystem as Record<string, any>;
    
    switch (cmd) {
      case 'DIR':
        const drive = args[0] || 'C:';
        if (fs[drive]) {
          let output = ` Volume in drive C is ARCHIMEDES\n Directory of ${drive}\n\n`;
          for (const [name, content] of Object.entries(fs[drive])) {
            const size = typeof content === 'object' ? '<DIR>' : '1024';
            output += `${name.padEnd(12)} ${size.padStart(10)}\n`;
          }
          return output;
        }
        return `Invalid drive specification`;
      
      case 'TYPE':
        const file = args[0];
        for (const [driveName, driveContents] of Object.entries(fs)) {
          if (typeof driveContents === 'object' && file.toUpperCase() in driveContents) {
            return driveContents[file.toUpperCase()];
          }
        }
        return `File not found - ${file}`;
      
      case 'MEM':
        return `Memory Type        Total       Used       Free\n` +
               `------------  ----------  ----------  ----------\n` +
               `Conventional         640K       128K       512K\n` +
               `Extended          15,360K     2,048K    13,312K`;
      
      default:
        return `${cmd} command executed`;
    }
  }

  // List all active systems
  async listSystems() {
    return await db.query.virtualSystems.findMany({
      where: eq(virtualSystems.isActive, true)
    });
  }

  // Connect to a virtual system
  async connectToSystem(hostname: string) {
    const system = await db.query.virtualSystems.findFirst({
      where: eq(virtualSystems.hostname, hostname)
    });

    if (!system || !system.isActive) {
      return null;
    }

    return {
      hostname: system.hostname,
      name: system.name,
      welcomeMessage: system.welcomeMessage,
      motd: system.motd,
      prompt: this.getPrompt(system.systemType as string)
    };
  }

  private getPrompt(systemType: string): string {
    switch (systemType) {
      case 'vms': return '$';
      case 'unix': return '$ ';
      case 'dos': return 'C:\\>';
      default: return '> ';
    }
  }
}

export const virtualSystemService = new VirtualSystemService();

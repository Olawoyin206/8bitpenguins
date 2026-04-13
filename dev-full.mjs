import { spawn } from 'node:child_process'

function startProcess(label, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${label} exited with signal ${signal}`)
      return
    }
    if (code && code !== 0) {
      console.log(`${label} exited with code ${code}`)
      shutdown(code)
    }
  })

  return child
}

const children = []

function shutdown(code = 0) {
  while (children.length) {
    const child = children.pop()
    if (child && !child.killed) {
      try {
        child.kill('SIGTERM')
      } catch {}
    }
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

children.push(startProcess('ipfs-api', process.execPath, ['dev-gallery-server.mjs']))
if (process.platform === 'win32') {
  children.push(startProcess('vite', 'cmd.exe', ['/c', 'npm', 'run', 'dev:web']))
} else {
  children.push(startProcess('vite', 'npm', ['run', 'dev:web']))
}

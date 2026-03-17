# Troubleshooting

## Linux: OS file watch limit reached / ENOSPC

Symptoms while running development server:

- `OS file watch limit reached`
- `ENOSPC: System limit for number of file watchers reached`

### Quick fix (current session)

```bash
sudo sysctl fs.inotify.max_user_watches=524288
sudo sysctl fs.inotify.max_user_instances=1024
```

### Persistent fix (recommended)

Create a sysctl config file:

```bash
printf "fs.inotify.max_user_watches=524288\nfs.inotify.max_user_instances=1024\n" | sudo tee /etc/sysctl.d/99-itemsforsale-inotify.conf
sudo sysctl --system
```

### Verify values

```bash
sysctl fs.inotify.max_user_watches
sysctl fs.inotify.max_user_instances
```

### Dev scripts in this repo

- `npm run dev`: webpack + polling (safe default on constrained Linux hosts)
- `npm run dev:webpack`: webpack without polling
- `npm run dev:turbo`: Turbopack

If your machine still has watcher pressure from other apps, keep using `npm run dev`.

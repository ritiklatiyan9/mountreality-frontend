# Account frontend EC2 deployment

Pull requests to `main` build the application. Merges and direct pushes to `main` additionally upload the verified `dist` artifact to EC2 and atomically switch the `current` symlink.

Create a GitHub environment named `production` with these secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_PRIVATE_KEY`
- `EC2_SSH_KNOWN_HOSTS`

Add these environment variables:

- `EC2_STATIC_ROOT`, for example `/var/www/mountreality-frontend`
- `VITE_API_URL`, for example `https://api.example.com`
- `PUBLIC_HEALTH_URL`, for example `https://app.example.com/`

Configure Nginx from `nginx-app.conf.example` and point its root at `<EC2_STATIC_ROOT>/current`. The EC2 deployment user must be able to create directories and symlinks below `EC2_STATIC_ROOT`; Nginx needs read/traverse access.

`VITE_API_URL` is public browser configuration. Backend credentials and other secrets must never be added to a Vite variable or committed frontend file.

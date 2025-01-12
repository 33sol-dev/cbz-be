module.exports = {
  apps: [
    {
      name: 'api-server',
      script: 'app.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'queue-worker',
      script: 'workers/queueWorker.js',
      instances: 1,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
    deploy: {
      production: {
        user: "ec2-user",
        host: "ec2-44-211-205-51.compute-1.amazonaws.com", // EC2 instance public DNS
        key: "CBZ-BE.pem", // Path to your private SSH key
        ref: "origin/main",
        repo: "git@github.com:33sol-dev/cbz-be.git", // Your GitHub repo
        path: "/home/ec2-user/cbz-be", // Deployment directory on the EC2 instance
        "pre-deploy-local": "",
        "post-deploy": "npm install && pm2 reload /home/ec2-user/cbz-be/ecosystem.config.js --env production"
      },
    },
  };
  
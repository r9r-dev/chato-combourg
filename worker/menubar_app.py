#!/usr/bin/env python3
"""
Chato Worker - macOS Menu Bar Application

Runs the PyTorch inference worker as a background service with a menu bar icon.
"""

import subprocess
import sys
import threading
import time
from pathlib import Path

import rumps

# Worker configuration
WORKER_DIR = Path(__file__).parent
WORKER_PORT = 50100
WORKER_HOST = "0.0.0.0"


class ChatoWorkerApp(rumps.App):
    """Menu bar application for Chato PyTorch Worker."""

    def __init__(self):
        super().__init__(
            name="Chato Worker",
            title="W",  # Simple text icon (will change based on status)
            quit_button=None,  # We'll add our own quit button
        )

        self.server_process = None
        self.server_thread = None
        self.is_running = False

        # Build menu
        self.menu = [
            rumps.MenuItem("Status: Stopped", callback=None),
            None,  # Separator
            rumps.MenuItem("Start Server", callback=self.toggle_server),
            rumps.MenuItem("Open Logs", callback=self.open_logs),
            None,  # Separator
            rumps.MenuItem("Quit", callback=self.quit_app),
        ]

        # Auto-start the server
        self.start_server()

        # Start status checker
        self.status_timer = rumps.Timer(self.check_status, 10)
        self.status_timer.start()

    def update_status(self, running: bool):
        """Update menu bar icon and status text."""
        self.is_running = running

        if running:
            self.title = "W"  # Green would be nice but rumps doesn't support colors easily
            self.menu["Status: Stopped"].title = f"Status: Running (port {WORKER_PORT})"
            self.menu["Start Server"].title = "Stop Server"
        else:
            self.title = "W"  # Could use a different character for stopped
            self.menu["Status: Stopped"].title = "Status: Stopped"
            self.menu["Start Server"].title = "Start Server"

    def start_server(self):
        """Start the uvicorn server in a subprocess."""
        if self.server_process is not None:
            return

        try:
            # Use the same Python interpreter
            python_path = sys.executable

            # Start uvicorn as subprocess
            self.server_process = subprocess.Popen(
                [
                    python_path, "-m", "uvicorn",
                    "main:app",
                    "--host", WORKER_HOST,
                    "--port", str(WORKER_PORT),
                ],
                cwd=str(WORKER_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )

            self.update_status(True)
            rumps.notification(
                title="Chato Worker",
                subtitle="Server Started",
                message=f"Listening on port {WORKER_PORT}",
            )

        except Exception as e:
            rumps.notification(
                title="Chato Worker",
                subtitle="Error",
                message=f"Failed to start server: {e}",
            )

    def stop_server(self):
        """Stop the uvicorn server."""
        if self.server_process is None:
            return

        try:
            self.server_process.terminate()
            self.server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.server_process.kill()
        finally:
            self.server_process = None
            self.update_status(False)
            rumps.notification(
                title="Chato Worker",
                subtitle="Server Stopped",
                message="Worker is no longer running",
            )

    @rumps.clicked("Start Server")
    def toggle_server(self, sender):
        """Toggle server start/stop."""
        if self.is_running:
            self.stop_server()
        else:
            self.start_server()

    @rumps.clicked("Open Logs")
    def open_logs(self, sender):
        """Open Console.app to view logs."""
        subprocess.run(["open", "-a", "Console"])

    def check_status(self, timer):
        """Periodically check if server is still running."""
        if self.server_process is not None:
            poll = self.server_process.poll()
            if poll is not None:
                # Process has terminated
                self.server_process = None
                self.update_status(False)
        else:
            self.update_status(False)

    @rumps.clicked("Quit")
    def quit_app(self, sender):
        """Quit the application and stop the server."""
        self.stop_server()
        rumps.quit_application()


def main():
    """Entry point."""
    ChatoWorkerApp().run()


if __name__ == "__main__":
    main()

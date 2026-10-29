#!/usr/bin/env python3
"""GOAT-HTML preview server: Python standard library only, cache-hostile.

Usage:  python serve.py [port] [directory] [--lan]

Why not just `npx http-server`? This one never caches (Cache-Control: no-store, so a
preview tab shows the file you just saved), handles 14 MB files without configuration,
and needs nothing installed.

By default it listens on 127.0.0.1 only (this machine). --lan listens on every
interface and prints this machine's LAN address so a phone on the same network can
open the page; it then serves the whole directory to that network, so use it only on
a network you trust and stop it when done.
"""
import http.server, os, socket, socketserver, sys


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".mjs": "text/javascript", ".wasm": "application/wasm"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("192.0.2.1", 9))          # TEST-NET address: no packet is sent
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lan = "--lan" in sys.argv[1:]
    port = int(args[0]) if args else 8421
    directory = args[1] if len(args) > 1 else "."
    os.chdir(directory)
    host = "0.0.0.0" if lan else "127.0.0.1"
    socketserver.ThreadingTCPServer.allow_reuse_address = False
    with socketserver.ThreadingTCPServer((host, port), Handler) as httpd:
        print(f"GOAT-HTML serving {os.getcwd()} at:", flush=True)
        print(f"  http://localhost:{port}/   (cache disabled)", flush=True)
        if lan:
            ip = lan_ip()
            print(f"  http://{ip}:{port}/   (LAN: phones on this network)" if ip
                  else "  (LAN address not found)", flush=True)
        print("Ctrl+C to stop.", flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()

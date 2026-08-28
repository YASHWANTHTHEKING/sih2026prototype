import os
import sys
import time
import subprocess
import webbrowser
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent

def check_environment():
    print("=" * 70)
    print(" AI-Based Automated Cadastral Mapping System (GeoAI & Web-GIS)")
    print("=" * 70)
    print(f"[+] Root Workspace: {ROOT_DIR}")
    print(f"[+] Python: {sys.version.split()[0]}")

def start_services():
    check_environment()
    
    # 1. Start FastAPI Backend
    print("\n[+] Starting FastAPI GeoAI Backend on port 8000...")
    backend_cmd = [
        sys.executable, "-m", "uvicorn", "backend.app.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload"
    ]
    backend_proc = subprocess.Popen(
        backend_cmd,
        cwd=str(ROOT_DIR),
        shell=True if os.name == 'nt' else False
    )

    time.sleep(2.0)

    # 2. Start Vite Frontend
    print("\n[+] Starting Web-GIS React Dashboard on port 5173...")
    frontend_dir = ROOT_DIR / "frontend"
    frontend_cmd = "npm run dev"
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=str(frontend_dir),
        shell=True
    )

    print("\n" + "=" * 70)
    print(" GeoCadastre AI is LIVE!")
    print(" -> Web-GIS Dashboard: http://localhost:5173")
    print(" -> FastAPI Backend:  http://localhost:8000")
    print(" -> Interactive Docs: http://localhost:8000/docs")
    print("=" * 70)
    print("Press Ctrl+C to stop all services.\n")

    try:
        webbrowser.open("http://localhost:5173")
    except Exception:
        pass

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nStopping GeoCadastre AI services...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Done.")

if __name__ == "__main__":
    start_services()

import urllib.request
import json
import os

url = "https://cbrqazorztbpnxwiytdb.supabase.co/rest/v1/messages?select=direction,content,created_at&order=created_at.desc&limit=10"

headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzgxOTYsImV4cCI6MjA5MDcxNDE5Nn0.W6c1Nyv5UfM7iZ2qFPQm7LqgXju-kxUKr3pXxwJgWbY",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzODE5NiwiZXhwIjoyMDkwNzE0MTk2fQ._jRGbPc6m0jXGhFpT8vLTLvayuyXFWM1-IAHKPOdroE"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print("MESSAGES:")
        for msg in data:
            print(f"[{msg['direction']}] {msg['content']}")
except Exception as e:
    print(f"Error: {e}")

url_visits = "https://cbrqazorztbpnxwiytdb.supabase.co/rest/v1/visit_appointments?select=*&order=created_at.desc&limit=5"
req_v = urllib.request.Request(url_visits, headers=headers)
try:
    with urllib.request.urlopen(req_v) as response:
        data = json.loads(response.read().decode())
        print("\nVISITS:")
        print(json.dumps(data, indent=2))
except Exception as e:
    print(f"Error: {e}")

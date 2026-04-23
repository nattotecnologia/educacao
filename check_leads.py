import urllib.request
import json
import os

url = "https://cbrqazorztbpnxwiytdb.supabase.co/rest/v1/leads?select=*&limit=1"

headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzgxOTYsImV4cCI6MjA5MDcxNDE5Nn0.W6c1Nyv5UfM7iZ2qFPQm7LqgXju-kxUKr3pXxwJgWbY",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNicnFhem9yenRicG54d2l5dGRiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzODE5NiwiZXhwIjoyMDkwNzE0MTk2fQ._jRGbPc6m0jXGhFpT8vLTLvayuyXFWM1-IAHKPOdroE"
}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        if data:
            print(json.dumps(list(data[0].keys()), indent=2))
        else:
            print("No leads found")
except Exception as e:
    print(f"Error: {e}")

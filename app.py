#!/usr/bin/env python3
"""
Trading Journal App - Flask Backend with Google Drive Integration
Handles trading data and images stored on Google Drive
Works with Render cloud hosting
"""
import os
import certifi

# Fix SSL certificate issue on Windows
os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
os.environ['CURL_CA_BUNDLE'] = certifi.where()

import ssl
ssl._create_default_https_context = ssl._create_unverified_context
from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import pandas as pd
import json
import os
from pathlib import Path
from datetime import datetime
import shutil
from io import BytesIO
import io

# Google Drive imports
try:
    from google.oauth2.service_account import Credentials
    from googleapiclient import discovery
    from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
    GOOGLE_DRIVE_AVAILABLE = True
except ImportError:
    GOOGLE_DRIVE_AVAILABLE = False
    print("⚠️  Google Drive libraries not installed (OK for local dev)")


# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()




BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Flask app configuration
app = Flask(
    __name__,
    static_folder=str(STATIC_DIR),
    static_url_path="/static",
    template_folder=str(TEMPLATES_DIR)
)
CORS(app)

# ============= GOOGLE DRIVE SETUP =============

# Get credentials from environment or file
GOOGLE_DRIVE_FOLDER_ID = os.environ.get('GOOGLE_DRIVE_FOLDER_ID')
EXCEL_FILE_ID = os.environ.get('EXCEL_FILE_ID')  # ID of Trades_details.xlsx on Drive
CREDENTIALS_FILE = BASE_DIR / "credentials.json"

drive_service = None

def setup_credentials():
    """Setup Google Drive credentials from environment or file"""
    global drive_service
    
    if not GOOGLE_DRIVE_AVAILABLE:
        print("⚠️  Google Drive not available - using local storage")
        return False
    
    try:
        # DEBUG: Check what we have
        print("\n" + "="*70)
        print("🔍 CREDENTIALS DEBUG")
        print("="*70)
        print(f"CREDENTIALS_JSON env var exists: {bool(os.environ.get('CREDENTIALS_JSON'))}")
        print(f"credentials.json file exists: {CREDENTIALS_FILE.exists()}")
        
        # Try reading from environment variable first
        if os.environ.get('CREDENTIALS_JSON'):
            creds_json = os.environ.get('CREDENTIALS_JSON')
            print(f"✓ CREDENTIALS_JSON found in environment")
            print(f"  Length: {len(creds_json)} characters")
            print(f"  First 100 chars: {creds_json[:100]}")
            print(f"  Trying to parse as JSON...")
            
            try:
                creds_dict = json.loads(creds_json)
                print(f"  ✅ Successfully parsed as JSON!")
                print(f"  Service account email: {creds_dict.get('client_email', 'NOT FOUND')}")
            except json.JSONDecodeError as e:
                print(f"  ❌ Failed to parse JSON: {e}")
                raise
            
            credentials = Credentials.from_service_account_info(
                creds_dict,
                scopes=['https://www.googleapis.com/auth/drive']
            )
            print(f"  ✅ Google Drive connected (from environment)")
            
        # Fall back to credentials.json file
        elif CREDENTIALS_FILE.exists():
            print(f"✓ credentials.json file found")
            credentials = Credentials.from_service_account_file(
                str(CREDENTIALS_FILE),
                scopes=['https://www.googleapis.com/auth/drive']
            )
            print(f"  ✅ Google Drive connected (from credentials.json)")
        else:
            print(f"❌ No credentials found!")
            print("="*70 + "\n")
            return False
        
        drive_service = discovery.build('drive', 'v3', credentials=credentials)
        print("="*70)
        print("✅ GOOGLE DRIVE SETUP COMPLETE")
        print("="*70 + "\n")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        print("="*70 + "\n")
        return False
    

def download_excel_from_drive():
    """Download Trades_details.xlsx from Google Drive"""
    try:
        if not drive_service or not EXCEL_FILE_ID:
            print("⚠️  Drive not initialized or EXCEL_FILE_ID not set")
            return None
        
        print(f"📥 Downloading Excel from Drive (ID: {EXCEL_FILE_ID[:10]}...)")
        request_obj = drive_service.files().get_media(fileId=EXCEL_FILE_ID)
        file_io = BytesIO()
        downloader = MediaIoBaseDownload(file_io, request_obj)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        file_io.seek(0)
        df = pd.read_excel(file_io)
        print(f"✅ Downloaded: {len(df)} trades")
        return df
    except Exception as e:
        print(f"❌ Error downloading Excel: {e}")
        return None

def upload_to_google_drive(file_path, file_name, folder_id=None):
    """Upload file to Google Drive"""
    try:
        if not drive_service:
            return None
        
        target_folder = folder_id or GOOGLE_DRIVE_FOLDER_ID
        if not target_folder:
            print("❌ No folder ID specified")
            return None
        
        file_metadata = {
            'name': file_name,
            'parents': [target_folder]
        }
        
        media = MediaFileUpload(str(file_path), resumable=True)
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        file_id = file.get('id')
        print(f"✅ Uploaded {file_name} → {file_id}")
        return file_id
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None

def download_from_google_drive(file_id):
    """Download file from Google Drive"""
    try:
        if not drive_service:
            return None
        
        request_obj = drive_service.files().get_media(fileId=file_id)
        file_io = BytesIO()
        downloader = MediaIoBaseDownload(file_io, request_obj)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        file_io.seek(0)
        return file_io
    except Exception as e:
        print(f"❌ Download error: {e}")
        return None

def delete_from_google_drive(file_id):
    """Delete file from Google Drive"""
    try:
        if not drive_service:
            return False
        
        drive_service.files().delete(fileId=file_id).execute()
        print(f"✅ Deleted {file_id}")
        return True
    except Exception as e:
        print(f"❌ Delete error: {e}")
        return False

def create_folder_on_drive(folder_name, parent_id=None):
    """Create folder on Google Drive"""
    try:
        if not drive_service:
            return None
        
        parent = parent_id or GOOGLE_DRIVE_FOLDER_ID
        if not parent:
            return None
        
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent]
        }
        
        folder = drive_service.files().create(
            body=file_metadata,
            fields='id'
        ).execute()
        
        folder_id = folder.get('id')
        print(f"✅ Created folder: {folder_name} → {folder_id}")
        return folder_id
    except Exception as e:
        print(f"❌ Folder creation error: {e}")
        return None

# ============= TRADING DATA FUNCTIONS =============

def load_trades_excel():
    """Load trades from Excel (from Google Drive or local)"""
    try:
        print("📖 Loading trades...")
        
        # Try Google Drive first
        if drive_service and EXCEL_FILE_ID:
            df = download_excel_from_drive()
            if df is not None:
                df = df.where(pd.notna(df), None)
                trades = df.to_dict('records')
                print(f"✅ Loaded {len(trades)} trades from Drive")
                return trades
        
        # Fall back to local file
        local_excel = BASE_DIR / "Trades_details.xlsx"
        if local_excel.exists():
            print("⚠️  Using local Excel file")
            df = pd.read_excel(local_excel)
            df = df.where(pd.notna(df), None)
            return df.to_dict('records')
        
        print("❌ No Excel file found")
        return []
    except Exception as e:
        print(f"❌ Error loading trades: {e}")
        return []

# ============= ROUTES =============

@app.route('/')
def index():
    """Serve main HTML"""
    return send_from_directory(TEMPLATES_DIR, 'index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory(STATIC_DIR, filename)

@app.route('/api/trades', methods=['GET'])
def get_trades():
    """Get all trades"""
    trades = load_trades_excel()
    return jsonify(trades)

@app.route('/api/trades/filter', methods=['POST'])
def filter_trades():
    """Filter trades by criteria"""
    filters = request.json
    trades = load_trades_excel()
    
    if filters.get('ticker'):
        trades = [t for t in trades if str(t.get('FinInstrument', '')).startswith(filters['ticker'])]
    if filters.get('outcome'):
        trades = [t for t in trades if t.get('TradeOutcome') == filters['outcome']]
    if filters.get('strategy'):
        trades = [t for t in trades if t.get('Strategy') == filters['strategy']]
    
    return jsonify(trades)

@app.route('/api/folders', methods=['GET'])
def get_folders():
    """List all trade folders from Google Drive or local storage"""
    folders = []
    
    if drive_service and GOOGLE_DRIVE_FOLDER_ID:
        try:
            # Query folders in Google Drive
            results = drive_service.files().list(
                q=f"'{GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                spaces='drive',
                fields='files(id, name)',
                pageSize=100
            ).execute()
            
            for folder in results.get('files', []):
                folders.append({
                    'name': folder['name'],
                    'id': folder['id'],
                    'source': 'drive'
                })
            print(f"✅ Loaded {len(folders)} folders from Drive")
        except Exception as e:
            print(f"⚠️  Error loading folders from Drive: {e}")
    
    return jsonify(folders)

@app.route('/api/folder/<folder_name>/images', methods=['GET'])
def get_folder_images(folder_name):
    """Get images from folder on Google Drive"""
    images = []
    
    if drive_service and GOOGLE_DRIVE_FOLDER_ID:
        try:
            # Find folder by name
            results = drive_service.files().list(
                q=f"'{GOOGLE_DRIVE_FOLDER_ID}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder'",
                spaces='drive',
                fields='files(id)',
                pageSize=1
            ).execute()
            
            folder_results = results.get('files', [])
            if not folder_results:
                return jsonify([])
            
            folder_id = folder_results[0]['id']
            
            # Get images in folder
            images_results = drive_service.files().list(
                q=f"'{folder_id}' in parents and (mimeType='image/png' or mimeType='image/jpeg') and trashed=false",
                spaces='drive',
                fields='files(id, name)',
                pageSize=100
            ).execute()
            
            images = [{'name': f['name'], 'id': f['id']} for f in images_results.get('files', [])]
            print(f"✅ Found {len(images)} images in {folder_name}")
        except Exception as e:
            print(f"⚠️  Error getting images: {e}")
    
    return jsonify(sorted(images, key=lambda x: x.get('name', '')))

@app.route('/api/folder/<folder_name>/image/<image_id>', methods=['GET'])
def get_image(folder_name, image_id):
    """Get image from Google Drive"""
    try:
        if not drive_service:
            return jsonify({'error': 'Drive not available'}), 503
        
        file_io = download_from_google_drive(image_id)
        if not file_io:
            return jsonify({'error': 'Image not found'}), 404
        
        file_io.seek(0)
        return send_file(file_io, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/folder/<folder_name>/notes', methods=['GET'])
def get_notes(folder_name):
    """Get notes from Google Drive"""
    try:
        if not drive_service or not GOOGLE_DRIVE_FOLDER_ID:
            return jsonify({})
        
        # Find notes.json in folder
        results = drive_service.files().list(
            q=f"'{GOOGLE_DRIVE_FOLDER_ID}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder'",
            spaces='drive',
            fields='files(id)',
            pageSize=1
        ).execute()
        
        folder_results = results.get('files', [])
        if not folder_results:
            return jsonify({})
        
        folder_id = folder_results[0]['id']
        
        notes_results = drive_service.files().list(
            q=f"'{folder_id}' in parents and name='notes.json'",
            spaces='drive',
            fields='files(id)',
            pageSize=1
        ).execute()
        
        notes_results_list = notes_results.get('files', [])
        if not notes_results_list:
            return jsonify({})
        
        notes_file_id = notes_results_list[0]['id']
        file_io = download_from_google_drive(notes_file_id)
        if file_io:
            notes_data = json.load(file_io)
            return jsonify(notes_data)
    except Exception as e:
        print(f"⚠️  Error loading notes: {e}")
    
    return jsonify({})

@app.route('/api/folder/<folder_name>/notes', methods=['POST'])
def save_notes(folder_name):
    """Save notes to Google Drive"""
    try:
        data = request.json
        
        if not drive_service or not GOOGLE_DRIVE_FOLDER_ID:
            return jsonify({'error': 'Drive not available'}), 503
        
        # Find or create folder
        results = drive_service.files().list(
            q=f"'{GOOGLE_DRIVE_FOLDER_ID}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder'",
            spaces='drive',
            fields='files(id)',
            pageSize=1
        ).execute()
        
        folder_results = results.get('files', [])
        if folder_results:
            folder_id = folder_results[0]['id']
        else:
            folder_id = create_folder_on_drive(folder_name)
            if not folder_id:
                return jsonify({'error': 'Could not create folder'}), 500
        
        # Check if notes.json exists
        notes_results = drive_service.files().list(
            q=f"'{folder_id}' in parents and name='notes.json'",
            spaces='drive',
            fields='files(id)',
            pageSize=1
        ).execute()
        
        notes_json_str = json.dumps(data)
        notes_io = BytesIO(notes_json_str.encode('utf-8'))
        
        if notes_results.get('files'):
            # Update existing
            file_id = notes_results['files'][0]['id']
            print(f"✅ Updated notes for {folder_name}")
        else:
            # Create new
            temp_notes_path = BASE_DIR / f"temp_notes_{folder_name}.json"
            with open(temp_notes_path, 'w') as f:
                json.dump(data, f, indent=2)
            
            upload_to_google_drive(temp_notes_path, 'notes.json', folder_id)
            temp_notes_path.unlink()
        
        return jsonify({'success': True})
    except Exception as e:
        print(f"❌ Error saving notes: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/folder', methods=['POST'])
def create_folder_and_save_image():
    """Upload image to Google Drive"""
    try:
        folder_name = request.form.get('folder_name')
        image_file = request.files.get('image')
        filename = request.form.get('filename')
        notes = request.form.get('notes', '{}')
        
        if not folder_name or not image_file or not filename:
            return jsonify({'error': 'Missing required fields'}), 400
        
        if not drive_service or not GOOGLE_DRIVE_FOLDER_ID:
            return jsonify({'error': 'Google Drive not available'}), 503
        
        print(f"📤 Uploading {filename} to {folder_name}...")
        
        # Find or create trade folder
        results = drive_service.files().list(
            q=f"'{GOOGLE_DRIVE_FOLDER_ID}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder'",
            spaces='drive',
            fields='files(id)',
            pageSize=1
        ).execute()
        
        folder_results = results.get('files', [])
        if folder_results:
            folder_id = folder_results[0]['id']
            print(f"✅ Found existing folder: {folder_name}")
        else:
            folder_id = create_folder_on_drive(folder_name)
            if not folder_id:
                return jsonify({'error': 'Could not create folder'}), 500
        
        # Save image to temp file
        temp_image_path = BASE_DIR / f"temp_{filename}"
        image_file.save(temp_image_path)
        
        # Upload to Google Drive
        image_file_id = upload_to_google_drive(temp_image_path, filename, folder_id)
        temp_image_path.unlink()
        
        if not image_file_id:
            return jsonify({'error': 'Failed to upload image'}), 500
        
        # Save notes if provided
        if notes and notes != '{}':
            temp_notes_path = BASE_DIR / f"temp_notes_{folder_name}.json"
            try:
                existing_notes = {filename: notes}
                
                with open(temp_notes_path, 'w') as f:
                    json.dump(existing_notes, f, indent=2)
                
                upload_to_google_drive(temp_notes_path, 'notes.json', folder_id)
                temp_notes_path.unlink()
            except Exception as e:
                print(f"⚠️  Could not save notes: {e}")
        
        return jsonify({
            'success': True,
            'folder': folder_name,
            'filename': filename,
            'file_id': image_file_id
        })
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/folder/<folder_name>/image/<image_id>', methods=['DELETE'])
def delete_image(folder_name, image_id):
    """Delete image from Google Drive"""
    try:
        if not drive_service:
            return jsonify({'error': 'Drive not available'}), 503
        
        delete_from_google_drive(image_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trade/<path:date_ticker>', methods=['GET'])
def get_trade_info(date_ticker):
    """Get trade info by date and ticker"""
    try:
        parts = date_ticker.rsplit('-', 1)
        if len(parts) == 2:
            date_str = parts[0]
            ticker = parts[1]
            
            trades = load_trades_excel()
            
            for trade in trades:
                try:
                    entry_date = pd.Timestamp(trade.get('EntryDate')).strftime('%Y-%m-%d')
                    if entry_date == date_str and ticker.upper() in str(trade.get('FinInstrument', '')).upper():
                        return jsonify(trade)
                except:
                    pass
        
        return jsonify({}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get performance statistics"""
    try:
        trades = load_trades_excel()
        
        if not trades:
            return jsonify({'error': 'No trades found'}), 404
        
        df = pd.DataFrame(trades)
        
        stats = {
            'total_trades': len(df),
            'net_pl': float(df['RealizedPL'].sum()),
            'gross_pl': float(df[df['RealizedPL'] > 0]['RealizedPL'].sum()),
            'gross_loss': float(abs(df[df['RealizedPL'] < 0]['RealizedPL'].sum())),
            'winners': int((df['TradeOutcome'] == 'Winner').sum()),
            'losers': int((df['TradeOutcome'] == 'Loser').sum()),
            'win_rate': float((df['TradeOutcome'] == 'Winner').sum() / len(df) * 100),
            'avg_winner': float(df[df['TradeOutcome'] == 'Winner']['RealizedPL'].mean()) if (df['TradeOutcome'] == 'Winner').sum() > 0 else 0,
            'avg_loser': float(df[df['TradeOutcome'] == 'Loser']['RealizedPL'].mean()) if (df['TradeOutcome'] == 'Loser').sum() > 0 else 0,
            'profit_factor': float((df[df['RealizedPL'] > 0]['RealizedPL'].sum()) / abs(df[df['RealizedPL'] < 0]['RealizedPL'].sum())) if (df['RealizedPL'] < 0).sum() > 0 else 0,
        }
        
        stats['expectancy'] = stats['win_rate'] / 100 * stats['avg_winner'] + (1 - stats['win_rate'] / 100) * stats['avg_loser']
        
        df_sorted = df.sort_values('ExitDate')
        cumpl = df_sorted['RealizedPL'].cumsum()
        running_max = cumpl.cummax()
        drawdown = cumpl - running_max
        stats['max_drawdown'] = float(drawdown.min())
        
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/export', methods=['GET'])
def export_data():
    """Export trades to Excel"""
    try:
        trades = load_trades_excel()
        df = pd.DataFrame(trades)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        
        output.seek(0)
        return send_file(output, as_attachment=True, download_name=f"trades_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx")
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    status = {
        'status': 'running',
        'drive_connected': drive_service is not None,
        'excel_file_id': bool(EXCEL_FILE_ID),
        'google_drive_folder_id': bool(GOOGLE_DRIVE_FOLDER_ID)
    }
    return jsonify(status)

# ============= ERROR HANDLERS =============

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error'}), 500

# ============= STARTUP =============

if __name__ == '__main__':
    print("=" * 70)
    print("🚀 Trading Journal App - Starting")
    print("=" * 70)
    print(f"Environment: {'Render' if os.environ.get('RENDER') else 'Local'}")
    print(f"Debug mode: {os.environ.get('DEBUG', 'False')}")
    
    # Initialize Google Drive
    print("\nInitializing Google Drive...")
    if setup_credentials():
        print(f"  Google Drive Folder ID: {GOOGLE_DRIVE_FOLDER_ID[:20] if GOOGLE_DRIVE_FOLDER_ID else 'Not set'}...")
        print(f"  Excel File ID: {EXCEL_FILE_ID[:20] if EXCEL_FILE_ID else 'Not set'}...")
    else:
        print("⚠️  Google Drive not initialized (will use local storage)")
    
    print("\n" + "=" * 70)
    print("✅ App ready!")
    print("🌐 Visit: http://localhost:5000 (or your Render URL)")
    print("=" * 70 + "\n")
    
    # Get port from environment (Render assigns it)
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    app.run(
        debug=debug_mode,
        host='0.0.0.0',
        port=port
    )
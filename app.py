#!/usr/bin/env python3
"""
Trading Journal App - Flask Backend
Handles file I/O, Excel operations, and data management
"""

from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import pandas as pd
import json
import os
from pathlib import Path
from datetime import datetime
import shutil

BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Flask app with explicit static and template paths
app = Flask(
    __name__,
    static_folder=str(STATIC_DIR),
    static_url_path="/static",
    template_folder=str(TEMPLATES_DIR)
)
CORS(app)

# Configuration
TRADES_FOLDER = BASE_DIR / "trades_data"
EXCEL_FILE = BASE_DIR / "Trades_details.xlsx"

# Create directories if they don't exist
TRADES_FOLDER.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)
STATIC_DIR.mkdir(exist_ok=True)

# Load Excel data
def load_trades_excel():
    """Load trades from Excel file"""
    try:
        if EXCEL_FILE.exists():
            df = pd.read_excel(EXCEL_FILE)
            
            # Replace NaN with None so JSON serialization works
            # (NaN is not valid JSON, but None becomes null in JSON)
            df = df.where(pd.notna(df), None)
            
            return df.to_dict('records')
    except Exception as e:
        print(f"Error loading Excel: {e}")
    return []

def save_trades_excel(data):
    """Save trades to Excel file"""
    try:
        df = pd.DataFrame(data)
        df.to_excel(EXCEL_FILE, index=False)
        return True
    except Exception as e:
        print(f"Error saving Excel: {e}")
        return False

# ============= Routes =============

@app.route('/')
def index():
    """Serve main HTML"""
    return send_from_directory(TEMPLATES_DIR, 'index.html')

@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS)"""
    return send_from_directory(STATIC_DIR, filename)

@app.route('/api/trades', methods=['GET'])
def get_trades():
    """Get all trades from Excel"""
    trades = load_trades_excel()
    return jsonify(trades)

@app.route('/api/trades/filter', methods=['POST'])
def filter_trades():
    """Filter trades by criteria"""
    filters = request.json
    trades = load_trades_excel()
    
    # Apply filters
    if filters.get('ticker'):
        trades = [t for t in trades if str(t.get('FinInstrument', '')).startswith(filters['ticker'])]
    if filters.get('outcome'):
        trades = [t for t in trades if t.get('TradeOutcome') == filters['outcome']]
    if filters.get('strategy'):
        trades = [t for t in trades if t.get('Strategy') == filters['strategy']]
    
    return jsonify(trades)

@app.route('/api/folders', methods=['GET'])
def get_folders():
    """List all trade folders"""
    folders = []
    if TRADES_FOLDER.exists():
        for folder in TRADES_FOLDER.iterdir():
            if folder.is_dir():
                images = list(folder.glob('*.png')) + list(folder.glob('*.jpg'))
                notes_file = folder / 'notes.json'
                notes = {}
                if notes_file.exists():
                    try:
                        with open(notes_file, 'r') as f:
                            notes = json.load(f)
                    except:
                        pass
                
                folders.append({
                    'name': folder.name,
                    'path': str(folder.relative_to(TRADES_FOLDER)),
                    'images': [img.name for img in images],
                    'notes': notes
                })
    
    return jsonify(folders)

@app.route('/api/folder/<folder_name>/images', methods=['GET'])
def get_folder_images(folder_name):
    """Get images from a folder"""
    folder_path = TRADES_FOLDER / folder_name
    images = []
    
    if folder_path.exists():
        for img_file in list(folder_path.glob('*.png')) + list(folder_path.glob('*.jpg')):
            images.append(img_file.name)
    
    return jsonify(sorted(images))

@app.route('/api/folder/<folder_name>/image/<image_name>', methods=['GET'])
def get_image(folder_name, image_name):
    """Get image file"""
    image_path = TRADES_FOLDER / folder_name / image_name
    if image_path.exists():
        return send_file(image_path, mimetype='image/png')
    return jsonify({'error': 'Image not found'}), 404

@app.route('/api/folder/<folder_name>/notes', methods=['GET'])
def get_notes(folder_name):
    """Get notes for a folder"""
    folder_path = TRADES_FOLDER / folder_name
    notes_file = folder_path / 'notes.json'
    
    if notes_file.exists():
        try:
            with open(notes_file, 'r') as f:
                return jsonify(json.load(f))
        except:
            pass
    
    return jsonify({})

@app.route('/api/folder/<folder_name>/notes', methods=['POST'])
def save_notes(folder_name):
    """Save notes for a folder"""
    folder_path = TRADES_FOLDER / folder_name
    notes_file = folder_path / 'notes.json'
    
    data = request.json
    
    try:
        folder_path.mkdir(parents=True, exist_ok=True)
        with open(notes_file, 'w') as f:
            json.dump(data, f, indent=2)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/folder', methods=['POST'])
def create_folder_and_save_image():
    """Create folder and save image"""
    try:
        folder_name = request.form.get('folder_name')
        image_file = request.files.get('image')
        notes = request.form.get('notes', '{}')
        filename = request.form.get('filename')
        
        if not folder_name or not image_file or not filename:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Create folder
        folder_path = TRADES_FOLDER / folder_name
        folder_path.mkdir(parents=True, exist_ok=True)
        
        # Save image
        image_path = folder_path / filename
        image_file.save(image_path)
        
        # Save notes if provided
        if notes and notes != '{}':
            notes_file = folder_path / 'notes.json'
            existing_notes = {}
            if notes_file.exists():
                try:
                    with open(notes_file, 'r') as f:
                        existing_notes = json.load(f)
                except:
                    pass
            
            existing_notes[filename] = notes
            with open(notes_file, 'w') as f:
                json.dump(existing_notes, f, indent=2)
        
        return jsonify({
            'success': True,
            'folder': folder_name,
            'filename': filename,
            'path': str(image_path.relative_to(TRADES_FOLDER))
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/folder/<folder_name>/image/<image_name>', methods=['DELETE'])
def delete_image(folder_name, image_name):
    """Delete image from folder"""
    try:
        image_path = TRADES_FOLDER / folder_name / image_name
        
        if image_path.exists():
            image_path.unlink()
            
            # Remove from notes
            notes_file = TRADES_FOLDER / folder_name / 'notes.json'
            if notes_file.exists():
                try:
                    with open(notes_file, 'r') as f:
                        notes = json.load(f)
                    if image_name in notes:
                        del notes[image_name]
                    with open(notes_file, 'w') as f:
                        json.dump(notes, f, indent=2)
                except:
                    pass
            
            return jsonify({'success': True})
        
        return jsonify({'error': 'Image not found'}), 404
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/folder/<folder_name>/image/<image_name>/rename', methods=['POST'])
def rename_image(folder_name, image_name):
    """Rename image file"""
    try:
        new_name = request.json.get('new_name')
        
        old_path = TRADES_FOLDER / folder_name / image_name
        new_path = TRADES_FOLDER / folder_name / new_name
        
        if old_path.exists():
            old_path.rename(new_path)
            
            # Update notes
            notes_file = TRADES_FOLDER / folder_name / 'notes.json'
            if notes_file.exists():
                try:
                    with open(notes_file, 'r') as f:
                        notes = json.load(f)
                    if image_name in notes:
                        notes[new_name] = notes.pop(image_name)
                    with open(notes_file, 'w') as f:
                        json.dump(notes, f, indent=2)
                except:
                    pass
            
            return jsonify({'success': True, 'new_name': new_name})
        
        return jsonify({'error': 'Image not found'}), 404
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trade/<path:date_ticker>', methods=['GET'])
def get_trade_info(date_ticker):
    """Get trade info from Excel by date and ticker"""
    try:
        # Parse date and ticker from path
        parts = date_ticker.rsplit('-', 1)
        if len(parts) == 2:
            date_str = parts[0]
            ticker = parts[1]
            
            trades = load_trades_excel()
            
            # Find matching trade
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
        
        # Calculate stats
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
        
        # Calculate expectancy
        stats['expectancy'] = stats['win_rate'] / 100 * stats['avg_winner'] + (1 - stats['win_rate'] / 100) * stats['avg_loser']
        
        # Calculate max drawdown
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
    """Export all data to Excel"""
    try:
        trades = load_trades_excel()
        df = pd.DataFrame(trades)
        
        export_path = BASE_DIR / f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        df.to_excel(export_path, index=False)
        
        return send_file(export_path, as_attachment=True)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============= Error Handlers =============

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error'}), 500

if __name__ == '__main__':
    print("=" * 60)
    print("Trading Journal App - Starting Server")
    print("=" * 60)
    print(f"Base directory: {BASE_DIR}")
    print(f"Trades folder: {TRADES_FOLDER}")
    print(f"Excel file: {EXCEL_FILE}")
    print("")
    print("Open your browser and go to: http://localhost:5000")
    print("=" * 60)
    print("")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
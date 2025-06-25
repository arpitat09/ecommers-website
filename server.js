const express = require('express');
const session = require('express-session');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 3000;

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',       // change as per your MySQL user
  password: 'Arpita@123',       // change as per your MySQL password
  database: 'ecommerce_db'
});

db.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err);
    process.exit(1);
  }
  console.log('Connected to MySQL');
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'verysecretkey',
  resave: false,
  saveUninitialized: true,
}));

// Serve static files like CSS from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Serve single HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'Provide username and password' });

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) return res.json({ success: false, message: 'Database error' });
    if (results.length > 0) return res.json({ success: false, message: 'Username taken' });

    const hashed = await bcrypt.hash(password, 10);
    db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed], (err) => {
      if (err) return res.json({ success: false, message: 'Failed to register' });
      res.json({ success: true, message: 'Registered successfully!' });
    });
  });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: 'Provide username and password' });

  db.query('SELECT * FROM users WHERE username = ?', [username], async (err, results) => {
    if (err) return res.json({ success: false, message: 'Database error' });
    if (results.length === 0) return res.json({ success: false, message: 'User not found' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ success: false, message: 'Incorrect password' });

    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true, message: 'Logged in', username: user.username });
  });
});

// Middleware to check auth
function isAuth(req, res, next) {
  if (req.session.userId) next();
  else res.status(401).json({ success: false, message: 'Not authenticated' });
}

// Get products
app.get('/products', isAuth, (req, res) => {
  db.query('SELECT * FROM products', (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    res.json({ success: true, products: results });
  });
});

// Place order
app.post('/order', isAuth, (req, res) => {
  const userId = req.session.userId;
  const { productIds, total } = req.body;
  if (!productIds || !total) return res.status(400).json({ success: false, message: 'Invalid order data' });

  const productIdsStr = JSON.stringify(productIds);

  db.query('INSERT INTO orders (user_id, product_ids, total) VALUES (?, ?, ?)', [userId, productIdsStr, total], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: 'Failed to save order' });

    // Generate receipt PDF
    const orderId = result.insertId;
    const receiptPath = path.join(__dirname, 'receipts');
    if (!fs.existsSync(receiptPath)) fs.mkdirSync(receiptPath);

    const receiptFile = path.join(receiptPath, `${req.session.username}_order_${orderId}.pdf`);

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(receiptFile));

    doc.fontSize(25).text('Order Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`Order ID: ${orderId}`);
    doc.text(`User: ${req.session.username}`);
    doc.text(`Date: ${new Date().toLocaleString()}`);
    doc.moveDown();
    doc.text('Products:', { underline: true });

    // Fetch product details for receipt
    db.query('SELECT * FROM products WHERE id IN (?)', [productIds], (err, products) => {
      if (err) return res.status(500).json({ success: false, message: 'Failed to fetch products for receipt' });

      products.forEach(p => {
        doc.text(`${p.name} - ₹${p.price}`);
      });
      doc.moveDown();
      doc.text(`Total: ₹${total}`, { bold: true });

      doc.end();

      res.json({ success: true, message: 'Order placed', receiptFile: `/receipt/${req.session.username}_order_${orderId}.pdf` });
    });
  });
});

// Serve receipt file
app.get('/receipt/:filename', isAuth, (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, 'receipts', filename);
  if (fs.existsSync(filepath)) {
    res.download(filepath);
  } else {
    res.status(404).send('Receipt not found');
  }
});

// Order history
app.get('/orders', isAuth, (req, res) => {
  const userId = req.session.userId;
  db.query('SELECT * FROM orders WHERE user_id = ?', [userId], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'DB error' });
    res.json({ success: true, orders: results });
  });
});

// Logout
app.post('/logout', isAuth, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: 'Logged out' });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

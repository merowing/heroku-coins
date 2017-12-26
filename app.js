var express = require('express');
var multer = require('multer');
var bodyParser = require('body-parser');
var session = require('express-session');
var postgres = require('pg');
var crypto = require('crypto');
var jimp = require('jimp');

var app = express();

//var conString = "postgres://axespynegkyzmy:6ba1932eae8eb6d474227cb4bcb026b0e583aa9fae073e35d32b4e39eab22d3f@ec2-54-217-250-0.eu-west-1.compute.amazonaws.com:5432/dc6afggvjq3hl3";
var conString = "postgres://postgres:root@localhost/coins";
var dbconnect = new postgres.Client(conString);
dbconnect.connect();

var config = {};
dbconnect.query(`SELECT * from config`, function(err, result) {
	config.coinsPerPage = result.rows[0].pages;
	config.phones = result.rows[0].phones;
	config.adminCoinsPerPage = result.rows[0].admin;
	config.emptyCategories = result.rows[0].emptyCategories;
});
//var coinsPerPage = 8;

var objCat = [];
var query1 = function(admin, callback) {
	objCat = [];
	var c = 0;
	dbconnect.query(`SELECT * from "categories"`, function(err, result) {
		if(result.rows.length > 0) {
			console.log("category:"+config.emptyCategories);
			if(!config.emptyCategories && !admin) {
				for(var i =0; i < result.rows.length; i += 1) {
					//console.log("categoryid " + result.rows[i].name);
					(function(i) {
						//c+=1;
					dbconnect.query(`SELECT * from items WHERE category='${result.rows[i].id}' AND status=1`, function(err, result2) {
						c+=1;
						console.log("L:"+result2.rows.length);
						if(result2.rows.length > 0) {
							console.log("i: " + i);
							console.log("categoryid " + result.rows[i].name);
							var objCat_temp = {};
							objCat_temp['name'] = result.rows[i].name;
							objCat_temp['id'] = result.rows[i].id;
							objCat.push(objCat_temp);
						}
						if(c === result.rows.length) {
							return callback(JSON.stringify(objCat));
						}
					});
					})(i);
				}
			}else {
				for(var i =0; i < result.rows.length; i += 1) {
					var objCat_temp = {};
					objCat_temp['name'] = result.rows[i].name;
					objCat_temp['id'] = result.rows[i].id;
					objCat.push(objCat_temp);
				}
				return callback(JSON.stringify(objCat));
			}
			console.log(objCat);
			//return callback(JSON.stringify(objCat));
		}else {
			return callback(null);
		}
	});
	console.log("2");
}


var storage = multer.diskStorage({
	destination: function(req, file, callback) {
		callback(null, './public/images');
	},
	filename: function(req, file, callback) {
		console.log("testtest");
		callback(null, file.originalname);
	}
});
var upload = multer({storage:storage}).array('images');

app.set('view engine', 'ejs');
//app.use( express.static( "images" ) );
app.use(express.static("public"));


app.use(session({
	secret:"FADSFAF23534dsf",
	resave:true,
	saveUninitialized: true
}));

var auth = function(req, res, next) {
	console.log(req.session.user);
	if(req.session.user) {
		dbconnect.query(`SELECT * from users WHERE name='${req.session.user}'`, function(err, result, fields) {
				if(req.session && req.session.user === result.rows[0].name && req.session.admin) {
					console.log("1");
					return next();
				
			}else {
				//req.session.destroy();
				return res.redirect('/login');
			}
		});
	}else {
		return res.redirect('/login');
	}
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', function(req, res) {
	query1(0, function(data){
		//console.log("d:"+data);
		items(0, 1, function(data2, pages) {
			//console.log("json:"+JSON.parse(data2));
			//data2 = JSON.parse(data2);
			//var pages = Math.floor(data2.length/8);
			//console.log(data2.length);
			var phones = (config.phones).toString();
			console.log("p1:" + typeof(phones));
			phones = phones.split(",");

			if(data === null) data = JSON.stringify([]);
			if(data2 === null) data2 = JSON.stringify([]);

			res.render('default', {
				title: 'Монеты',
				session: req.session.user,
				categories: JSON.parse(data),
				coins: JSON.parse(data2),
				pages: pages,
				phones: phones
			});
		});
	});
});

app.get('/login', function(req, res) {
	if(!req.session.user) {
		res.render('login', {
			title: 'Вход'
		});
	}else {
		res.redirect('/admin');
	}
});
app.post('/login', function(req, res) {
	var data = req.body;

	dbconnect.query(`SELECT * from users WHERE name='${data.user}'`, function(err, result, fields) {
		if(result) {
			//console.log(rows[0]['name']);
			//9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
			var cryptoPass = crypto.createHash('sha256').update(data.pass.toLowerCase()).digest('hex');
			console.log(data.pass);
			console.log(cryptoPass);
			console.log(result.rows[0]['password']);
			if(data && data.user === result.rows[0]['name'] && cryptoPass === result.rows[0]['password'].toLowerCase()) {
				req.session.user = data.user;
				req.session.admin = true;
				res.redirect('/admin');
			}else {
				res.render('login', {
					title: 'Вход',
					error: 'Неверный логил или пароль'
				});
			}
		}else {
			res.render('login', {
				title: 'Вход',
				error: 'Пользователь с таким именем не существует'
			});
		}
	});

	//console.log(req.body);
	
});
app.get('/logout', function(req, res) {
	req.session.destroy();
	res.redirect('/');
});

app.get('/admin', auth, function(req, res) {
	var num, all;
	var adminItems = config.adminCoinsPerPage;
	if(!req.params.page) num = 0;
	else num = (req.params.page - 1) * adminItems;
	console.log(num);
	dbconnect.query(`SELECT * from "items"`, (err, result3) => {
		if(result3.rows.length) all = result3.rows.length;
		console.log('all:'+all);
		console.log("num:" + num);
		console.log("adminItems:" + adminItems);
		dbconnect.query(`SELECT * from "items" ORDER BY "id" DESC LIMIT ${adminItems} OFFSET ${num}`, function(err, result) {
			console.log("result" + result.rows.length);
			if(result === undefined) result = [];
			dbconnect.query(`SELECT * from "categories"`, function(err, result2) {
				for(var i = 0; i < result2.rows.length; i += 1) {
					for(var j = 0; j < result.rows.length; j += 1) {
						if(+result2.rows[i].id === +result.rows[j].category) {
							result.rows[j].category = result2.rows[i].name;
						}
						if(+result.rows[j].category === 0) {
							result.rows[j].category = "Общая";
						}
					}
				}
				console.log("res:"+result);
				if(result.rows.length)
				for(var n = 0; n < result.rows.length; n += 1) {
					result.rows[n].image = (result.rows[n].image).split(",")[0];
				}
				res.render('admin', {
					title: 'Панель управления',
					classname: 'home',
					itemsData:JSON.stringify(result.rows),
					nums:num,
					allPages:all,
					aItems:adminItems
				});
			});
		});
	});
});
app.get('/admin/page/:pages?', auth, function(req, res) {
	var num, all;
	var adminItems = config.adminCoinsPerPage;
	if(!req.params.pages) num = 0;
	else num = (req.params.pages - 1) * adminItems;
	console.log(num);
	dbconnect.query(`SELECT * from items`, (err, result3) => {
		if(result3) all = result3.rows.length;
		console.log(all);
		dbconnect.query(`SELECT * from "items" ORDER BY "id" DESC LIMIT ${adminItems} OFFSET ${num}`, function(err, result) {
			if(result === undefined) result = [];
			dbconnect.query(`SELECT * from categories`, function(err, result2) {
				for(var i = 0; i < result2.rows.length; i += 1) {
					for(var j = 0; j < result.rows.length; j += 1) {
						if(+result2.rows[i].id === +result.rows[j].category) {
							result.rows[j].category = result2.rows[i].name;
						}
						if(+result.rows[j].category === 0) {
							result.rows[j].category = "Общая";
						}
					}
				}
				res.render('admin', {
					title: 'Панель управления',
					classname: 'home',
					itemsData:JSON.stringify(result.rows),
					nums:num,
					allPages:all,
					aItems:adminItems
				});
			});
		});
	});
});
app.get('/admin/del', function(req, res) {
	var arr = req.query.uniq;
	console.log(arr);
	//console.log(req.query.url);
	//var url = req.query.url;
	var uArr = arr.split(',');
	arr = "";
	//bacause. don't ask me
	for(var i = 0; i < uArr.length; i += 1) {
		if(i === uArr.length - 1) {
			arr += `'${uArr[i]}'`;	
			continue;
		}
		arr += `'${uArr[i]}',`;
	}

	var sql = `DELETE from items WHERE "uniqId" IN (${arr})`;
	dbconnect.query(sql, function(err) {
		console.log(err);
		//res.send(`<meta http-equiv="refresh" content="0; url=${url}" />`);
		res.send('done');
	});
});
app.get('/admin/show', function(req, res) {
	var uniq = req.query.uniq;
	var status = (+req.query.status === 0) ? 1 : 0;

	var uArr = uniq.split(',');
	uniq = "";
	for(var i = 0; i < uArr.length; i += 1) {
		if(i === uArr.length - 1) {
			uniq += `'${uArr[i]}'`;	
			continue;
		}
		uniq += `'${uArr[i]}',`;
	}

	var sql = `UPDATE "items" SET status=${status} WHERE "uniqId" IN (${uniq})`;
	dbconnect.query(sql, function(err) {
		console.log(err);
		res.send('done');
	});
});

var getYears = function(callback) {
	dbconnect.query(`SELECT * from years`, function(err, result) {

		if(result) {
			var objCat = [];
			for(var i =0; i < result.rows.length; i += 1) {
				var objCat_temp = {};
				objCat_temp['year'] = result.rows[i].year;
				//objCat_temp['id'] = rows[i].id;
				objCat.push(objCat_temp);
			}
			return callback(JSON.stringify(objCat));
		}else {
			return callback(null);
		}
	});
}

app.get('/admin/add', auth, function(req, res) {
	query1(1, function(data) {
		getYears(function(year_data) {
			//console.log(year_data);
			if(year_data === null) year_data = JSON.stringify([]);
			if(data === null) data = JSON.stringify([]);

			var jsonYears = JSON.parse(year_data);
			for(var i = 0; i < jsonYears.length; i += 1) {
				for(var i1 = 0; i1 < jsonYears.length; i1 += 1) {
					if(+jsonYears[i].year < +jsonYears[i1].year) {
						var buff = jsonYears[i];
						jsonYears[i] = jsonYears[i1];
						jsonYears[i1] = buff;
					}
				}
			}

			res.render('admin/add', {
				title: 'Панель управления - Добавить',
				years:jsonYears,
				categories:JSON.parse(data)
			});
		});
	});
});


app.get('/admin/info', auth, function(req, res) {
	dbconnect.query(`SELECT * from config WHERE id=1`, function(err, result) {
		console.log(result.rows[0].pages);
		res.render('admin/info', {
			title: "Панель управления - Настройки",
			current: result.rows[0].pages,
			phones: result.rows[0].phones,
			adminItems: result.rows[0].admin,
			cancel: result.rows[0].cancelDelete,
			empty: result.rows[0].emptyCategories
		});
	});
});

var getCategoryId = function(categoryName, callback) {
	dbconnect.query(`SELECT * from "categories" WHERE "name"='${categoryName}'`, function(err, result) {
		var id = result.rows[0].id;
		//console.log(categoryName + " - " +rows);
		return callback(id);
	});
}

function resizeImage(images, callback) {

	var image = images.split(",");
	console.log(image[0]);
	//var ext;
	for(var i =0; i<image.length; i+=1) {
		(function(i) {
		var ext = image[i].split(".");
		console.log(ext[0]);
		jimp.read("public/images/" + image[i], function(err, img) {
			if(err) throw err;
			img.resize(200, jimp.AUTO).write("public/images/thumbs/" + ext[0] + "." + ext[1]);
		});
		})(i);
	}

	callback();
}

app.post('/admin/upload', auth, function(req, res) {
	upload(req, res, function(err){
		if(err) {
			return res.end("Error");
		}


		var data = req.body;
		var categoryId;

		if(typeof(data.nyear) !== 'undefined') {
			dbconnect.query(`INSERT INTO years ("year") VALUES ('${data.nyear}')`, function(err) {
				console.log(err);
			});
		}
			

			var name = data.name;
			var year = data.nyear || data.gyear;
			var price = data.price || 0;
			var description = data.description;
			var image = [], images = "";
			var uniqId; //= Math.floor(Math.random() * (9999 - 1000) + 1000);
			var category = data.category1 || 0;
			var money_type = data.money_type;
			var status = data.status;
			var contract = data.contract || 0;
console.log("contract"+contract);
			console.log(data);

			if(typeof(data.edit) !== 'undefined') {
				uniqId = +data.uniq;
			}else {
				uniqId = Math.floor(Math.random() * (9999 - 1000) + 1000);
			}
	//console.log(req.files[0].filename);
			//var len = req.files.length;
			//var files = req.files;
			req.files.forEach(function(val, index, arr) {
				//console.log(arr[index].filename);
				image.push(arr[index].filename);
			});
			/*for(var i = 0; i < files.length; i + 1) {
				console.log(files[i].filename);
			}*/
			images = image.join(",");
			if(images === "" && typeof(data.edit) === 'undefined') images = "default.png";
			var uSql = `UPDATE "items" SET 
					"name"='${name}',
					"year"='${year}',
					"price"='${price}',
					"description"='${description}',
					"image"='${images}',
					"category"='${category}',
					"money_type"='${money_type}',
					"status"='${status}',
					"contract"=${contract} WHERE "uniqId"='${uniqId}'`;
			if(images === "" && typeof(data.edit) !== 'undefined') {
				uSql = `UPDATE "items" SET 
					"name"='${name}',
					"year"='${year}',
					"price"='${price}',
					"description"='${description}',
					"category"='${category}',
					"money_type"='${money_type}',
					"status"='${status}',
					"contract"=${contract} WHERE "uniqId"='${uniqId}'`;
			}

			console.log(images);
			console.log(typeof(data.edit));
			if(typeof(data.edit) !== 'undefined') {
				dbconnect.query(uSql, function(err) {
					console.log(err);
				});
			}else {
				dbconnect.query(`INSERT INTO items ("name","year","price","description","image","uniqId","category","money_type","status","contract") VALUES ('${name}','${year}','${price}','${description}','${images}','${uniqId}','${category}','${money_type}','${status}', '${contract}') RETURNING *`, function(err) {
					if(err)
						console.log(err);
					else
						console.log('added new items ' + name);
				});
			}

			if(typeof(data.category2) !== 'undefined') {
				dbconnect.query(`INSERT INTO "categories" ("name") VALUES ('${data.category2}') RETURNING *`, function(err) {
					console.log(err);
				});

				var datac = data.category2;
				getCategoryId(datac, function(id) {
					categoryId = id;
					console.log(uniqId);
					dbconnect.query(`UPDATE items SET "category"='${categoryId}' WHERE "uniqId"='${uniqId}'`, function(err) {
						console.log(err);
					});
				});
			}
			if(image.length) {
				resizeImage(images, function() {

					if(typeof(data.edit) === 'undefined') {
						res.send(`<meta http-equiv="refresh" content="0; url=/admin/add" />`);
					}else {
						res.send(`<meta http-equiv="refresh" content="0; url=/admin" />`);
					}

				});
			}else {
				if(typeof(data.edit) === 'undefined') {
					res.send(`<meta http-equiv="refresh" content="0; url=/admin/add" />`);
				}else {
					res.send(`<meta http-equiv="refresh" content="0; url=/admin" />`);
				}
			}
		//console.log(req.body);
		//console.log(req.files[0].filename);
	});
});

var items = function(id, page, callback) {
	var start = (page - 1) * config.coinsPerPage;
	console.log("start"+start);
	var sql = "";
	if(id === 0) {
		sql = `SELECT * from "items"`;
	}else {
		sql = `SELECT * from "items" WHERE category='${id}'`;
	}
dbconnect.query(sql, function(err, result2) {
	var pages = result2.rows.length;
	pages = Math.ceil(pages/config.coinsPerPage);
	
	if(id === 0) {
		sql = `SELECT * from "items" WHERE status=1 LIMIT ${config.coinsPerPage} OFFSET ${start}`;
	}else {
		sql = `SELECT * from "items" WHERE category='${id}' AND status=1 LIMIT ${config.coinsPerPage} OFFSET ${start}`;
	}
	dbconnect.query(sql, function(err, result) {
		var objCat = [];
//console.log("rows length:" + rows[0].itemsCount);
		console.log("id:"+id);
		//console.log(result);
		if(result) {
			for(var i =0; i < result.rows.length; i += 1) {
				var objCat_temp = {};
				objCat_temp['name'] = result.rows[i].name;
				objCat_temp['year'] = result.rows[i].year;
				objCat_temp['price'] = result.rows[i].price;
				objCat_temp['description'] = result.rows[i].description;
				objCat_temp['image'] = result.rows[i].image;
				objCat_temp['uniqId'] = result.rows[i].uniqId;
				objCat_temp['category'] = result.rows[i].category;
				objCat_temp['money_type'] = result.rows[i].money_type;
				objCat_temp['contract'] = result.rows[i].contract;

				objCat_temp['id'] = result.rows[i].id;
				objCat.push(objCat_temp);
			}
			
			return callback(JSON.stringify(objCat), pages);

		}else {
			return callback(null);
		}
	});
});
}

app.get('/category/:id?/:page?', function(req, res) {
	console.log(req.params.id);
	var id = req.params.id;
	var page = req.params.page || 1;
	console.log("page" + page);
	if(id === "all") id = 0;
query1(0, function(data) {
	console.log("id - "+id);
		items(id, page, function(data2, pages) {
//console.log(JSON.parse(data2));
			if(data === null) data = JSON.stringify([]);
			var category = JSON.parse(data);
			//console.log(category[1]);
			
			var categoryName;
			for(var i = 0; i<category.length; i+= 1) {
				if(+category[i].id === +id) {
					categoryName = category[i].name;
				}
			}
			var phones = config.phones.toString();
			phones = phones.split(",");
			var categoryName = (id !== 0) ? categoryName : "Все монеты";
			res.render('default',{
				title:'Монеты - ' + categoryName,
				session: req.session.user,
				categories:category,
				coins:JSON.parse(data2) || "",
				pages:pages,
				phones:phones
			});

		});
});
});

app.get('/admin/edit/:coin?', auth, function(req, res) {
	query1(1, function(data) {
		getYears(function(year_data) {
			//console.log(year_data);
			if(year_data === null) year_data = JSON.stringify([]);
			if(data === null) data = JSON.stringify([]);

			var jsonYears = JSON.parse(year_data);
			for(var i = 0; i < jsonYears.length; i += 1) {
				for(var i1 = 0; i1 < jsonYears.length; i1 += 1) {
					if(+jsonYears[i].year < +jsonYears[i1].year) {
						var buff = jsonYears[i];
						jsonYears[i] = jsonYears[i1];
						jsonYears[i1] = buff;
					}
				}
			}

			res.render('admin/add', {
				title: 'Панель управления - Добавить',
				years:jsonYears,
				categories:JSON.parse(data)
			});
		});
	});
});
app.post('/admin/edit', auth, function(req, res) {
	var coinId = req.body.coin;
	console.log("c:"+coinId);
	dbconnect.query(`SELECT * from "items" WHERE "uniqId"='${coinId}'`, function(err, result) {
		res.send(JSON.stringify(result.rows[0]));
	});
});
app.post('/admin/update', auth, function(req, res) {
	//var coinId = req.params.coin;
	res.send(`<meta http-equiv="refresh" content="0; url=/admin/edit/"${coinId} />`);
});

app.get('/admin/config', auth, function(req, res) {
	dbconnect.query(`SELECT * from "config"`, function(err, result) {
		res.send(JSON.stringify(result.rows[0]));
	});
});
app.post('/admin/config', auth, function(req, res) {
	var data = req.body;
	var phones = data.phones;
	var adminItems = data.admin;
	var cancelDelete = data.cancelDelete;
	var emptyCategories = data.emptyCategories;

	if(!cancelDelete) cancelDelete = 0;
	if(!emptyCategories) emptyCategories = 0;

	if(phones.lenght > 1)
		phones = data.phones.join(",");
	dbconnect.query(`UPDATE config SET "pages"='${data.page}', "phones"='${phones}', "admin"='${adminItems}', "cancelDelete"='${cancelDelete}', "emptyCategories"='${emptyCategories}' WHERE id=1`, function(err) {
		console.log(err);

		if(data.newpass !== "") {
			var pass = crypto.createHash('sha256').update(data.newpass).digest('hex')
			dbconnect.query(`UPDATE users SET password='${pass}' WHERE name='${req.session.user}'`, function(err) {
				console.log(err);
			});
		}

		config.coinsPerPage = data.page;
		config.phones = phones;
		config.adminCoinsPerPage = data.admin;
		config.emptyCategories = data.emptyCategories;

		console.log("p:" + data.phones);
		res.send(`<meta http-equiv="refresh" content="0; url=/admin/info" />`);
	});
	/*dbconnect.query(`SELECT * from config`, function(err, rows) {
		config.coinsPerPage = rows[0].pages;
	});*/
});

app.get('/delivery', function(req, res) {
	query1(0, function(data) {
	var phones = config.phones.toString();
			phones = phones.split(",");

	if(data === null) data = JSON.stringify([]);
	var category = JSON.parse(data);

	res.render('delivery',{
		title:'Монеты - Доставка',
		session: req.session.user,
		categories:category,
		phones:phones
	});
});
});

app.get('/contacts', function(req, res) {
	query1(0, function(data) {
	var phones = config.phones.toString();
			phones = phones.split(",");

	if(data === null) data = JSON.stringify([]);
	var category = JSON.parse(data);

	res.render('contacts',{
		title:'Монеты - Контакты',
		session: req.session.user,
		categories:category,
		phones:phones
	});
});
});

app.get('/coininfo',function(req, res) {
	var sql = `SELECT * from "items" WHERE "uniqId"='${req.query.uniq}'`;
	dbconnect.query(sql, function(err, result) {
		res.send(JSON.stringify(result.rows[0]));
	});
});

app.listen(process.env.PORT || 3000 ,function(){
	console.log('server start');
});
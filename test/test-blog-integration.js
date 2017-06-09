const chai = require('chai')
const chaiHttp = require('chai-http')
const faker = require('faker')
const mongoose = require('mongoose')

const should = chai.should()

const {DATABASE_URL} = require('../config')
const {BlogPost} = require('../models')
const {app, runServer, closeServer} = require('../server')
const {TEST_DATABASE_URL} = require('../config')

chai.use(chaiHttp)

function seedBlogData() {
	console.info('creating test database by seeding blog data')
	const seedData = []

	for (let i=1; i <= 10; i++){
		seedData.push(generateBlogData())
	}

	return BlogPost.insertMany(seedData)
}

function generateName() {
	return {
		firstName: faker.name.firstName(),
		lastName: faker.name.lastName(),
	}
}

function generateTitle(){
	return faker.random.word() + " " + faker.random.word() + " " + faker.random.word()
}

function generateContent(){
	return faker.lorem.paragraph()
}

function generateBlogData(){
	return { 
		author: generateName(),
		title: generateTitle(),
		content: generateContent(),
	}
}

function tearDownDb(){
	return new Promise((resolve, reject) => {
		console.warn('Deleting test database')
		return mongoose.connection.dropDatabase()
			.then(result => resolve(result))
			.catch(err => reject(err))
	})
}

describe('Blog Posts API resource', () => {
	before(function(){
		console.info(`opening test server at ${TEST_DATABASE_URL}`)
		return runServer(TEST_DATABASE_URL)
	})

	beforeEach(function(){
		return seedBlogData()
	})
	
	afterEach(function(){
		return tearDownDb()
	})

	after(function(){
		return closeServer()
	})

	describe('GET endpoint', () => {

		it('should return all existing blog posts', () => {
			let res;
			return chai.request(app)
				.get('/posts')
				.then(_res => {
					res = _res;
					res.should.have.status(200);
			        res.body.should.have.length.of.at.least(1);

					return BlogPost.count();
				})
				.then(count => {
					//res.body.should.have.length.of(count) threw err
					//it did not recognize it was a function, below
					//is a work around
					res.body.should.have.length.of.at.most(count)
					res.body.should.have.length.of.at.least(count)
				})
		})

		it('should return posts with right fields', () => {
			let resPost;
			return chai.request(app)
				.get('/posts')
				.then(res =>{
					res.should.have.status(200)
					res.should.be.json
					res.body.should.be.a('array')
					res.body.should.have.length.of.at.least(1)

					res.body.forEach(post => {
						post.should.be.a('object')
						post.should.include.keys(
							'id', 'author', 'title', 'content', 'created')
					})
					resPost = res.body[0]
					return BlogPost.findById(resPost.id).exec()
				})
				.then(post => {
					resPost.id.should.equal(post.id)
					resPost.author.should.equal(post.author.firstName + " " + post.author.lastName)
					resPost.title.should.equal(post.title)
					resPost.content.should.equal(post.content)
				})
		})
	})

	describe('POST endpoint', () => {

		it('should add a new blog post', () => {
			const newPost = generateBlogData()

			return chai.request(app)
				.post('/posts')
				.send(newPost)
				.then(res => {
					res.should.have.status(201)
					res.should.be.json
					res.body.should.be.a('object')
					res.body.should.include.keys('id', 'author', 'title', 'content', 'created')
					res.body.author.should.be.equal(newPost.author.firstName + " " + newPost.author.lastName)
					res.body.title.should.be.equal(newPost.title)
					res.body.content.should.be.equal(newPost.content)
					return BlogPost.findById(res.body.id)
				})
				.then(post => {
					post.author.firstName.should.be.equal(newPost.author.firstName)
					post.author.lastName.should.be.equal(newPost.author.lastName)
					post.title.should.be.equal(newPost.title)
					post.content.should.be.equal(newPost.content)
				})
		})
	})

	describe('PUT endpoint', () => {
		it('should update fields sent over', () =>{
			const updateData = {
				title: "bubba lubba dub dub",
				content: "it means great suffering"
			}
			return BlogPost
				.findOne()
				.exec()
				.then(post => {
					updateData.id = post.id
					return chai.request(app)
						.put(`/posts/${post.id}`)
						.send(updateData)
				})
				.then(res => {
					res.should.have.status(201)

					return BlogPost.findById(updateData.id).exec()
				})
				.then(post => {
					post.title.should.be.equal(updateData.title)
					post.content.should.be.equal(updateData.content)
				})
		})
	})

	describe('DELETE endpoint', () => {
		it('delete a post by id', () => {
			let post;

			return BlogPost
				.findOne()
				.exec()
				.then( _post => {
					post = _post
					return chai.request(app).delete(`/posts/${post.id}`);
				})
				.then(res=> {
					res.should.have.status(204)
					return BlogPost.findById(post.id).exec()
				})
				.then(_post => {
					should.not.exist(_post)
				})
		})
	})
})
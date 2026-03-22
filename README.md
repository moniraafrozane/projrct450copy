# CSE Society Event & Budget Management System

A comprehensive web-based platform designed to streamline event organization, student registration, budget management, and financial oversight for the CSE Society at Shahjalal University of Science and Technology.


## Overview

This system replaces manual paper-based processes with a centralized digital platform, offering role-based access control, automated workflows, and complete audit trails.

It supports three types of users:
- Students
- Society Members (Event Organizers)
- Administrators


## Key Features

### Student Module

- Secure login using registration number
- Browse available events
- Apply for events
- Upload bank receipt
- Download payment receipt
- Download certificate
- View event history
- Receive notifications


### Society Member Module

- Create event budgets
- Submit budget for approval
- Edit and resubmit budgets
- Manage event expenses
- Upload vouchers / proof
- Submit post-event reports
- Forward applications to admin


### Admin Module

- Approve / reject applications
- Approve / edit / return budgets
- Manage users
- Generate reports
- Monitor audit trail
- Upload documents
- Financial record management
- Advanced search & filter


## Technology Stack

### Frontend
- React.js 

### Backend
- Node.js with Express

### Database
-PostgreSQL
### Hosting
- AWS / Azure / Cloud

### Other
- REST API
- HTTPS Security
- Role Based Access Control
- Email / SMS API


## System Requirements

- Node.js installed
- PostgreSQL installed
- Internet connection
- Modern browser


## Security Features

- Password hashing
- HTTPS encryption
- Role-based access control
- Audit trail logging
- Admin approval workflow


## Installation & Setup

### Clone Repository
git clone https://github.com/moniraafrozane/projrct450copy.git
cd cse-society-management
### Install Backend


cd backend
npm install


### Install Frontend


cd frontend
npm install


### Run Backend


cd backend
npm start


### Run Frontend


cd frontend
npm start



## Environment Configuration

Backend `.env`


PORT=5000
DB_CONNECTION=your_database
JWT_SECRET=your_secret
EMAIL_API_KEY=your_key
SMS_API_KEY=your_key


Frontend `.env`


REACT_APP_API_URL=http://localhost:5000/api



## Project Structure


cse-society-management/
├ backend/
├ frontend/
├ docs/
├ tests/
└ README.md

## Reporting

- Student statistics
- Event statistics
- Budget reports
- Financial reports
- Audit logs


## License

This project is submitted in partial fulfillment of the requirements for the degree of

Bachelor of Science in Computer Science and Engineering  
Shahjalal University of Science and Technology


## Authors

Monira Afroz Ane  
Reg No: 2020331081  

Jui Sultana Lima  
Reg No: 2020331068  


## Supervisor

Md. Eamin Rahman  
Assistant Professor  
Department of CSE  
SUST

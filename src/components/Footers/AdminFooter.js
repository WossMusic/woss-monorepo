/*!

=========================================================
* Woss Music Template Version 1.0
=========================================================

* Copyright 2024 Woss Music / Warner Music Latina Inc.

* Coded by Jetix Web

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/

import React from "react";
import 'assets/css/argon-dashboard-pro-react.css';

// reactstrap components
import {
    Container,
    Row,
    Col
} from "reactstrap";


function AdminFooter() { 
    return (
      <footer className="footer">
          <Container fluid>
            <hr className="mt-1"></hr>
              <Row className="align-items-center">
                  <Col xs="12">
                      <div className="copyright text-muted mb-4">
                          <span className="font-weight-bold text-black">
                              ©{new Date().getFullYear()} Woss Music | Warner Music Group | Portal Artist
                          </span>
                      </div>
                  </Col>
              </Row>
          </Container>
      </footer>
    );
  }
  
export default AdminFooter;


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
    Badge,
    Card,
    CardHeader,
    Table,
    Container,
    Row,
    Col,
    Media,
} from "reactstrap";
// core components
import TransactionsHeader from "components/Headers/TransactionsHeader.js";

function Transactions() {
    return (
        <>
            <TransactionsHeader />
            <Container className="mt--6" fluid >
                <Row >
                    <Col xs="12">
                        <Card className="shadow-card">
                            <CardHeader className="border-0">
                                <Row>
                                    <Col xs="10">
                                        <h3 className="mb-0 text-white"><i className="fa fa-list-alt"></i> Transactions History</h3>
                                    </Col>

                                </Row>
                            </CardHeader>
                            
                            <Table className="align-items-center table-flush" responsive>
                                <thead className="thead">
                                    <tr>
                                        <th className="sort" data-sort="transactionprojecttitle" scope="col">Project Name</th>
                                        <th className="sort" data-sort="transactiondate" scope="col">Date</th>
                                        <th className="sort" data-sort="transactionamount" scope="col">Amount</th>
                                        <th className="sort" data-sort="transactionmethod" scope="col">Method</th>
                                        <th className="sort" data-sort="transactionstatus" scope="col">Status</th>
                                        <th scope="col" />
                                    </tr>
                                </thead>
                                <tbody className="list">
                                    <tr>
                                        <th scope="row">
                                            <Media className="align-items-center">
                                                <div className="avatar rounded-circle mr-3" >
                                                    <i class="fa fa-music"></i>
                                                </div>
                                                <Media>
                                                    <span className="name mb-0 text-sm">Las Gemelas Del Free</span>
                                                </Media>
                                            </Media>
                                        </th>
                                        <td className="budget text-sm font-weight-bold">Sept 19, 2024</td>
                                        <td className="rdate text-sm font-weight-bold">USD$2,543</td>
                                        <td className="rdate text-sm font-weight-bold">Wire Transfer</td>
                                        <td>
                                            <Badge className="badge-dot mr-4" color="">
                                                <i className="bg-success" />
                                                <span className="status text-sm font-weight-bold">Completed</span>
                                            </Badge>
                                        </td>

                                    </tr>

                                    {/* Additional rows can be included here */}
                                </tbody>
                            </Table>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </>
    );
}

export default Transactions;
